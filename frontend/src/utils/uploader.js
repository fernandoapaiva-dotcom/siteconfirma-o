/**
 * Resilient Uploader Engine v4 — Turbo Pipeline com Background Fetch e Retomada Instantânea
 * 
 * 1. SUPORTE A SEGUNDO PLANO:
 *    - No Android Chrome: Background Fetch API (o sistema operacional assume o envio)
 *    - No iOS Safari / desktop: Streaming paralelo resiliente com WakeLock e retomada instantânea
 * 
 * 2. VELOCIDADE TURBO:
 *    - Fotos (< 8MB): Envio direto via streaming acelerado (conclui em segundos)
 *    - Vídeos e arquivos grandes (>= 8MB): Envio em chunks de 2MB com recuperação automática
 *    - Execução paralela de arquivos (até 2 em paralelo)
 *    - Nunca trava em sockets zumbis (timeouts de 15s)
 *    - Ao voltar para a tela (visibilitychange/focus), acorda e atualiza o progresso instantaneamente
 */

import { backgroundKeepAlive } from "./backgroundKeepAlive.js";

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB por chunk
const DIRECT_UPLOAD_LIMIT = 8 * 1024 * 1024; // Arquivos menores que 8MB vão direto (super rápido)
const BC_CHANNEL_NAME = "analu-upload-channel";

/**
 * Comprime imagens no navegador preservando alta qualidade visual.
 */
export async function compressImage(file) {
  const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|m4v|3gp|webm|avi)$/i.test(file.name);
  if (isVideo) return file;
  if (file.size < 400 * 1024) return file;

  try {
    let sourceImage = null;

    if (typeof createImageBitmap === "function") {
      try {
        sourceImage = await createImageBitmap(file);
      } catch (e) {}
    }

    if (!sourceImage) {
      sourceImage = await new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Erro ao carregar imagem"));
        };
        img.src = url;
      });
    }

    const MAX_DIM = 2048;
    let { width, height } = sourceImage;

    if (width > MAX_DIM || height > MAX_DIM) {
      if (width > height) {
        height = Math.round((height * MAX_DIM) / width);
        width = MAX_DIM;
      } else {
        width = Math.round((width * MAX_DIM) / height);
        height = MAX_DIM;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      if (sourceImage.close) sourceImage.close();
      return file;
    }

    ctx.drawImage(sourceImage, 0, 0, width, height);
    if (sourceImage.close) sourceImage.close();

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.84);
    });

    if (blob && blob.size < file.size) {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
    }

    return file;
  } catch (err) {
    console.warn("[Uploader] Falha na compressão local, enviando arquivo original:", err);
    return file;
  }
}

/**
 * Verifica se o navegador suporta Background Fetch. Na primeira visita (comum no
 * dia do evento, com muitos convidados abrindo o link pela primeira vez), o Service
 * Worker pode ainda estar instalando/ativando quando o usuário toca em enviar — por
 * isso primeiro checamos "controller" (instantâneo, sem esperar nada, quando o SW já
 * está no controle da página) e só depois esperamos "ready" com uma folga generosa
 * (4s) antes de desistir e cair no modo de compatibilidade.
 */
async function supportsBackgroundFetch() {
  if (!("serviceWorker" in navigator) || !("BackgroundFetchManager" in window)) {
    return false;
  }
  if (navigator.serviceWorker.controller) {
    // SW já está ativo e no controle desta página — sem necessidade de esperar nada.
    try {
      const reg = await navigator.serviceWorker.ready;
      return !!(reg && "backgroundFetch" in reg);
    } catch (e) {
      return false;
    }
  }
  try {
    const regPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 4000)
    );
    const reg = await Promise.race([regPromise, timeoutPromise]);
    return !!(reg && "backgroundFetch" in reg);
  } catch (e) {
    return false;
  }
}

/**
 * ESTRATÉGIA 1: Background Fetch API (Android Chrome)
 * O próprio sistema operacional gerencia as requisições em segundo plano.
 */
async function uploadViaBackgroundFetch(files, guestName, { onProgress, onSuccess, onError }) {
  const totalFiles = files.length;
  const bgFetchId = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  onProgress({
    phase: "optimizing",
    statusText: `Preparando ${totalFiles} arquivo(s) para envio nativo em segundo plano...`,
    currentFile: 1,
    totalFiles,
    progress: 4,
  });

  const allRequests = [];
  const uploadManifest = [];
  let totalUploadBytes = 0;

  for (let fileIdx = 0; fileIdx < totalFiles; fileIdx++) {
    const file = files[fileIdx];
    const uploadId = `upl_${Date.now()}_${fileIdx}_${Math.random().toString(36).substring(2, 7)}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    uploadManifest.push({
      uploadId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      nome: guestName || "Convidado",
      totalChunks,
    });

    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      const start = chunkIdx * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunkBlob = file.slice(start, end);

      const formData = new FormData();
      formData.append("uploadId", uploadId);
      formData.append("chunkIndex", chunkIdx.toString());
      formData.append("totalChunks", totalChunks.toString());
      formData.append("fileName", file.name);
      formData.append("mimeType", file.type || "application/octet-stream");
      formData.append("nome", guestName || "Convidado");
      formData.append("chunk", chunkBlob);

      allRequests.push(
        new Request("/api/upload-chunk", {
          method: "POST",
          body: formData,
        })
      );
      totalUploadBytes += chunkBlob.size;
    }
  }

  onProgress({
    phase: "sending",
    statusText: "Iniciando envio em segundo plano pelo sistema...",
    currentFile: 1,
    totalFiles,
    progress: 8,
  });

  try {
    // navigator.serviceWorker.ready já deve estar resolvido nesse ponto (o SW é
    // registrado no carregamento da página, bem antes do usuário tocar em enviar),
    // então isso não deveria consumir a janela de ativação transitória do usuário.
    const swReg = await navigator.serviceWorker.ready;

    // Chama backgroundFetch.fetch() o quanto antes, ainda dentro do gesto do usuário.
    // Qualquer outra coisa assíncrona antes disso arrisca deixar o Chrome rejeitar a
    // chamada por "falta de user activation".
    const bgFetch = await swReg.backgroundFetch.fetch(bgFetchId, allRequests, {
      title: `Enviando ${totalFiles} mídia${totalFiles > 1 ? "s" : ""} do batizado...`,
      downloadTotal: 1024 * 1024,
    });

    // Salva o manifesto no cache para o Service Worker consultar (não é urgente,
    // só precisa estar pronto quando o backgroundfetchsuccess disparar no SW).
    try {
      const manifestCache = await caches.open("upload-manifest");
      await manifestCache.put(
        new Request(`/_manifest/${bgFetchId}`),
        new Response(JSON.stringify(uploadManifest))
      );
    } catch (e) {}

    localStorage.setItem(
      "analu_bg_upload",
      JSON.stringify({
        id: bgFetchId,
        totalFiles,
        guestName,
        manifest: uploadManifest,
        startedAt: Date.now(),
      })
    );

    bgFetch.addEventListener("progress", () => {
      const uploaded = bgFetch.uploaded || 0;
      const uploadTotal = bgFetch.uploadTotal || totalUploadBytes;
      const percent = uploadTotal > 0
        ? Math.min(Math.round((uploaded / uploadTotal) * 90) + 8, 99)
        : 50;

      onProgress({
        phase: "sending",
        statusText: "Enviando em segundo plano nativo (pode sair ou bloquear o celular)...",
        currentFile: Math.min(Math.ceil((uploaded / uploadTotal) * totalFiles) || 1, totalFiles),
        totalFiles,
        progress: percent,
      });
    });

    const bc = new BroadcastChannel(BC_CHANNEL_NAME);

    return new Promise((resolve) => {
      const cleanup = () => {
        try { bc.close(); } catch (e) {}
        localStorage.removeItem("analu_bg_upload");
      };

      bc.onmessage = (event) => {
        const data = event.data;
        if (data.id !== bgFetchId) return;

        cleanup();
        if (data.type === "BG_FETCH_COMPLETE") {
          onProgress({
            phase: "done",
            statusText: totalFiles > 1
              ? `Todas as ${totalFiles} mídias foram enviadas com sucesso!`
              : "Mídia enviada com sucesso!",
            currentFile: totalFiles,
            totalFiles,
            progress: 100,
          });
          if (onSuccess) onSuccess({ successCount: totalFiles, total: totalFiles });
          resolve();
        } else if (data.type === "BG_FETCH_FAILED" || data.type === "BG_FETCH_ABORTED") {
          if (onError) onError(new Error("Erro no envio em segundo plano."));
          resolve();
        }
      };

      if (bgFetch.result === "success") {
        cleanup();
        onProgress({
          phase: "done",
          statusText: "Mídia enviada com sucesso!",
          currentFile: totalFiles,
          totalFiles,
          progress: 100,
        });
        if (onSuccess) onSuccess({ successCount: totalFiles, total: totalFiles });
        resolve();
      }
    });
  } catch (err) {
    console.error("[Uploader] Background Fetch rejeitou, acionando fallback:", err);
    throw err;
  }
}

/**
 * Envio direto de arquivo pequeno (< 8MB) em uma única requisição rápida
 */
async function uploadDirectFile(file, guestName) {
  const formData = new FormData();
  formData.append("fotos", file);
  formData.append("nome", guestName || "Convidado");

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

/**
 * Envio de arquivo grande (>= 8MB) via chunks com o Worker resiliente
 */
function uploadChunkedFile(worker, file, guestName, state, onProgressUpdate) {
  const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  return new Promise((resolve, reject) => {
    if (!worker) {
      return reject(new Error("Worker indisponível"));
    }

    const handleMessage = (e) => {
      const { type, uploadId: msgId, chunkSize, chunkIndex, result, error } = e.data;
      if (msgId !== uploadId) return;

      if (type === "CHUNK_PROGRESS") {
        state.addUploadedBytes(chunkSize);
        onProgressUpdate({
          phase: "sending",
          statusText: `Enviando ${file.name} (${chunkIndex + 1}/${totalChunks})...`,
          progress: state.calculateOverallProgress(0, false),
        });
      } else if (type === "FILE_SUCCESS") {
        worker.removeEventListener("message", handleMessage);
        resolve(result);
      } else if (type === "FILE_ERROR") {
        worker.removeEventListener("message", handleMessage);
        reject(new Error(error));
      }
    };

    worker.addEventListener("message", handleMessage);
    worker.postMessage({
      type: "UPLOAD_FILE",
      payload: { file, uploadId, guestName, chunkSize: CHUNK_SIZE, totalChunks },
    });
  });
}

/**
 * ESTRATÉGIA 2: Fallback Resiliente (iOS Safari e navegadores sem Background Fetch)
 * - Executa em paralelo
 * - Fotos pequenas vão direto em 1 request
 * - Acorda imediatamente com PAGE_RESUMED ao voltar à tela
 */
async function uploadViaFallback(files, guestName, { onProgress, onSuccess, onError }) {
  backgroundKeepAlive.start();

  const beforeUnloadListener = (e) => {
    e.preventDefault();
    e.returnValue = "O envio das suas fotos ainda está em andamento. Deseja sair mesmo assim?";
    return e.returnValue;
  };
  window.addEventListener("beforeunload", beforeUnloadListener);

  let worker = null;
  try {
    worker = new Worker(new URL("./uploadWorker.js", import.meta.url), { type: "module" });
  } catch (err) {
    console.warn("[Uploader] Worker fallback indisponível:", err.message);
  }

  // Acorda worker instantaneamente quando o usuário volta para a aba
  const handlePageResumed = () => {
    if (document.visibilityState === "visible") {
      if (worker) {
        worker.postMessage({ type: "PAGE_RESUMED" });
      }
    }
  };
  document.addEventListener("visibilitychange", handlePageResumed);
  window.addEventListener("focus", handlePageResumed);

  try {
    const totalFiles = files.length;
    const approxTotalBytes = files.reduce((acc, f) => acc + f.size, 0);

    const state = {
      uploadedBytes: 0,
      addUploadedBytes(bytes) {
        this.uploadedBytes += bytes;
      },
      calculateOverallProgress(additionalBytes = 0, isDone = false) {
        if (isDone) return 100;
        if (approxTotalBytes === 0) return 100;
        const raw = ((this.uploadedBytes + additionalBytes) / approxTotalBytes) * 92 + 5;
        return Math.min(Math.round(raw), 99);
      },
    };

    const successList = [];
    const failureList = [];

    // Processa arquivos com concorrência de até 2 uploads simultâneos
    const queue = files.map((file, index) => ({ file, index }));
    const activePromises = [];
    const CONCURRENCY = 2;

    async function processItem({ file, index }) {
      onProgress({
        phase: "sending",
        statusText: `Enviando ${file.name} (${index + 1} de ${totalFiles})...`,
        currentFile: index + 1,
        totalFiles,
        currentFileName: file.name,
        progress: state.calculateOverallProgress(0, false),
      });

      try {
        let result = null;

        // Se o arquivo for menor que 8MB e não for vídeo grande, usa envio direto super rápido!
        const isLargeVideo = file.size >= DIRECT_UPLOAD_LIMIT;

        if (!isLargeVideo) {
          result = await uploadDirectFile(file, guestName);
          state.addUploadedBytes(file.size);
        } else {
          // Arquivo grande: usa chunking com retry inteligente
          result = await uploadChunkedFile(
            worker,
            file,
            guestName,
            state,
            (progressData) => {
              onProgress({
                ...progressData,
                currentFile: index + 1,
                totalFiles,
                currentFileName: file.name,
              });
            }
          );
        }

        successList.push({ file: file.name, result });
      } catch (err) {
        console.error(`[Uploader] Erro no arquivo ${file.name}:`, err);
        failureList.push({ file: file.name, error: err.message });
      }
    }

    // Loop de controle de concorrência
    for (const item of queue) {
      const p = processItem(item).then(() => {
        activePromises.splice(activePromises.indexOf(p), 1);
      });
      activePromises.push(p);
      if (activePromises.length >= CONCURRENCY) {
        await Promise.race(activePromises);
      }
    }
    await Promise.all(activePromises);

    if (failureList.length === 0) {
      onProgress({
        phase: "done",
        statusText: totalFiles > 1
          ? `Todas as ${totalFiles} mídias foram enviadas com sucesso!`
          : "Mídia enviada com sucesso!",
        currentFile: totalFiles,
        totalFiles,
        progress: 100,
      });
      if (onSuccess) onSuccess({ successCount: totalFiles, total: totalFiles });
    } else if (successList.length > 0) {
      onProgress({
        phase: "partial",
        statusText: `${successList.length} de ${totalFiles} mídias enviadas (${failureList.length} com falha).`,
        currentFile: totalFiles,
        totalFiles,
        progress: 100,
      });
      if (onSuccess) onSuccess({ successCount: successList.length, total: totalFiles, failures: failureList });
    } else {
      throw new Error("Não foi possível concluir o envio das mídias.");
    }
  } catch (err) {
    console.error("[Uploader] Erro fatal:", err);
    onProgress({
      phase: "error",
      statusText: "Erro ao enviar mídias. Verifique a conexão e tente novamente.",
      currentFile: 0,
      totalFiles: files.length,
      progress: 0,
    });
    if (onError) onError(err);
  } finally {
    document.removeEventListener("visibilitychange", handlePageResumed);
    window.removeEventListener("focus", handlePageResumed);
    if (worker) { try { worker.terminate(); } catch (e) {} }
    backgroundKeepAlive.stop();
    window.removeEventListener("beforeunload", beforeUnloadListener);
  }
}

/**
 * Função principal chamada pela interface
 */
export async function startResilientUpload(files, guestName, callbacks) {
  if (!files || files.length === 0) return;

  const { onProgress } = callbacks;

  // 1. Tenta Background Fetch API nativo IMEDIATAMENTE, ainda dentro da janela de
  //    "ativação transitória do usuário" aberta pelo toque no botão de enviar.
  //    O Chrome só permite backgroundFetch.fetch() por poucos segundos após o gesto
  //    do usuário — se a gente comprimir imagens/vídeos (operação assíncrona, pode
  //    levar vários segundos com várias mídias) antes de chamar isso, essa janela
  //    expira e o Chrome rejeita a chamada silenciosamente, caindo sempre no fallback.
  const bgFetchSupported = await supportsBackgroundFetch();

  if (bgFetchSupported) {
    console.log("[Uploader] ✅ Background Fetch API disponível!");
    try {
      await uploadViaBackgroundFetch(files, guestName, callbacks);
      return;
    } catch (err) {
      console.warn("[Uploader] Background Fetch falhou (ou o gesto do usuário expirou), acionando pipeline concorrente:", err.message);
    }
  }

  // 2. Fallback: aqui sim vale comprimir localmente, já que essa via depende da aba
  //    continuar rodando e cada byte a menos ajuda a terminar mais rápido.
  const processedFiles = [];
  for (let i = 0; i < files.length; i++) {
    onProgress({
      phase: "optimizing",
      statusText: `Preparando ${files[i].name}...`,
      currentFile: i + 1,
      totalFiles: files.length,
      currentFileName: files[i].name,
      progress: Math.round((i / files.length) * 6),
    });
    processedFiles.push(await compressImage(files[i]));
  }

  // 3. Pipeline acelerado com retomada automática
  await uploadViaFallback(processedFiles, guestName, callbacks);
}

/**
 * Consulta uploads em segundo plano pendentes ao abrir a página
 */
export async function checkPendingBackgroundUpload() {
  try {
    const stored = localStorage.getItem("analu_bg_upload");
    if (!stored) return null;

    const data = JSON.parse(stored);
    if (!("serviceWorker" in navigator)) {
      localStorage.removeItem("analu_bg_upload");
      return null;
    }

    const swReg = await navigator.serviceWorker.ready;
    if (!("backgroundFetch" in swReg)) {
      localStorage.removeItem("analu_bg_upload");
      return null;
    }

    const bgFetch = await swReg.backgroundFetch.get(data.id);
    if (!bgFetch) {
      try {
        const cache = await caches.open("upload-state");
        const stateRes = await cache.match(`/_upload-state/${data.id}`);
        if (stateRes) {
          const state = await stateRes.json();
          localStorage.removeItem("analu_bg_upload");
          await cache.delete(`/_upload-state/${data.id}`);
          return {
            completed: true,
            success: state.success,
            totalFiles: data.totalFiles,
          };
        }
      } catch (e) {}

      localStorage.removeItem("analu_bg_upload");
      return null;
    }

    if (bgFetch.result === "") {
      return {
        completed: false,
        bgFetch,
        totalFiles: data.totalFiles,
        id: data.id,
      };
    }

    localStorage.removeItem("analu_bg_upload");
    return {
      completed: true,
      success: bgFetch.result === "success",
      totalFiles: data.totalFiles,
    };
  } catch (e) {
    localStorage.removeItem("analu_bg_upload");
    return null;
  }
}

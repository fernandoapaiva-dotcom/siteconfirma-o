/**
 * Resilient Uploader Engine v3 — Background Fetch API
 * 
 * ESTRATÉGIA DEFINITIVA para upload em segundo plano no celular:
 * 
 * 1. PRIMÁRIO: Background Fetch API (Chrome Android 74+)
 *    - O BROWSER gerencia os uploads, não o JavaScript
 *    - Funciona mesmo quando o usuário troca de app ou bloqueia a tela
 *    - O SO trata como um download/upload nativo do navegador
 *    - Mostra progresso na barra de notificações do Android
 * 
 * 2. FALLBACK: Upload direto com chunks (navegadores sem Background Fetch)
 *    - Usa Web Worker + backgroundKeepAlive como antes
 *    - Funciona no desktop e iOS Safari (que não suporta Background Fetch)
 * 
 * A compressão de imagens continua sendo feita ANTES do upload começar,
 * já que precisa do Canvas API (só disponível na thread principal).
 */

import { backgroundKeepAlive } from "./backgroundKeepAlive.js";

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB por chunk (mais rápido e metade das requisições)
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
 * Verifica se o navegador suporta Background Fetch API
 */
async function supportsBackgroundFetch() {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return "backgroundFetch" in reg;
  } catch (e) {
    return false;
  }
}

/**
 * ESTRATÉGIA PRINCIPAL: Background Fetch API
 * 
 * Cria todos os Request objects para os chunks de todos os arquivos,
 * e passa tudo para backgroundFetch.fetch() de uma vez.
 * O BROWSER gerencia as requisições, não o JavaScript.
 */
async function uploadViaBackgroundFetch(files, guestName, { onProgress, onSuccess, onError }) {
  const totalFiles = files.length;
  const bgFetchId = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  onProgress({
    phase: "optimizing",
    statusText: `Preparando ${totalFiles} arquivo(s) para envio em segundo plano...`,
    currentFile: 1,
    totalFiles,
    progress: 3,
  });

  // 1. Prepara todos os Request objects para cada chunk de cada arquivo
  const allRequests = [];
  const uploadManifest = []; // Metadata para cada arquivo
  let totalUploadBytes = 0;

  for (let fileIdx = 0; fileIdx < totalFiles; fileIdx++) {
    const file = files[fileIdx];
    const uploadId = `upl_${Date.now()}_${fileIdx}_${Math.random().toString(36).substring(2, 7)}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    uploadManifest.push({
      uploadId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      totalChunks,
    });

    // Cria um Request para cada chunk
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
    statusText: "Iniciando envio em segundo plano...",
    currentFile: 1,
    totalFiles,
    progress: 5,
  });

  // 2. Inicia o Background Fetch — o browser assume o controle nativo
  try {
    const swReg = await navigator.serviceWorker.ready;

    // Salva o manifesto no cache para o Service Worker consultar se necessário
    try {
      const manifestCache = await caches.open("upload-manifest");
      await manifestCache.put(
        new Request(`/_manifest/${bgFetchId}`),
        new Response(JSON.stringify(uploadManifest))
      );
    } catch (e) {}

    const bgFetch = await swReg.backgroundFetch.fetch(bgFetchId, allRequests, {
      title: `Enviando ${totalFiles} mídia${totalFiles > 1 ? "s" : ""} do batizado...`,
      icons: [
        {
          sizes: "192x192",
          src: "/vite.svg",
          type: "image/svg+xml",
        },
      ],
      downloadTotal: 0,
    });

    // Salva o estado no localStorage para recuperação
    localStorage.setItem("analu_bg_upload", JSON.stringify({
      id: bgFetchId,
      totalFiles,
      guestName,
      manifest: uploadManifest,
      startedAt: Date.now(),
    }));

    // 3. Monitora o progresso enquanto a página está aberta
    bgFetch.addEventListener("progress", () => {
      const uploaded = bgFetch.uploaded || 0;
      const uploadTotal = bgFetch.uploadTotal || totalUploadBytes;
      const percent = uploadTotal > 0
        ? Math.min(Math.round((uploaded / uploadTotal) * 92) + 5, 99)
        : 50;

      onProgress({
        phase: "sending",
        statusText: bgFetch.result === ""
          ? `Enviando em segundo plano... (pode sair do app!)`
          : "Finalizando...",
        currentFile: Math.min(Math.ceil((uploaded / uploadTotal) * totalFiles) || 1, totalFiles),
        totalFiles,
        progress: percent,
      });
    });

    // 4. Escuta via BroadcastChannel quando o SW notifica conclusão
    const bc = new BroadcastChannel(BC_CHANNEL_NAME);
    
    return new Promise((resolve) => {
      const cleanup = () => {
        try { bc.close(); } catch (e) {}
        localStorage.removeItem("analu_bg_upload");
      };

      bc.onmessage = (event) => {
        const data = event.data;
        if (data.id !== bgFetchId) return;

        if (data.type === "BG_FETCH_COMPLETE") {
          cleanup();
          if (data.success) {
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
          } else {
            onProgress({
              phase: "partial",
              statusText: `Envio concluído com ${data.failedCount || "alguns"} erros.`,
              currentFile: totalFiles,
              totalFiles,
              progress: 100,
            });
            if (onSuccess) onSuccess({ successCount: totalFiles - (data.failedCount || 0), total: totalFiles, failures: [] });
          }
          resolve();
        } else if (data.type === "BG_FETCH_FAILED") {
          cleanup();
          onProgress({
            phase: "error",
            statusText: "Erro no envio em segundo plano. Reabra o site para tentar novamente.",
            currentFile: 0,
            totalFiles,
            progress: 0,
          });
          if (onError) onError(new Error(data.failureReason || "Background fetch failed"));
          resolve();
        } else if (data.type === "BG_FETCH_ABORTED") {
          cleanup();
          onProgress({
            phase: "error",
            statusText: "Envio cancelado.",
            currentFile: 0,
            totalFiles,
            progress: 0,
          });
          if (onError) onError(new Error("Upload aborted"));
          resolve();
        }
      };

      // Se o bgFetch já terminou (resultado rápido), verifica
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
      } else if (bgFetch.result === "failure") {
        cleanup();
        if (onError) onError(new Error("Background fetch failed immediately"));
        resolve();
      }
    });

  } catch (err) {
    console.error("[Uploader] Background Fetch falhou ao iniciar:", err);
    throw err; // Vai cair no fallback
  }
}


/**
 * FALLBACK: Upload via Web Worker ou direto (para browsers sem Background Fetch)
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
    console.warn("[Uploader] Web Worker não suportado:", err.message);
  }

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
      addUploadedBytes(bytes) { this.uploadedBytes += bytes; },
      calculateOverallProgress(additionalBytes = 0, isDone = false) {
        if (isDone) return 100;
        if (approxTotalBytes === 0) return 100;
        const raw = ((this.uploadedBytes + additionalBytes) / approxTotalBytes) * 92 + 5;
        return Math.min(Math.round(raw), 99);
      },
    };

    const successList = [];
    const failureList = [];

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];

      onProgress({
        phase: "sending",
        statusText: `Enviando arquivo ${i + 1} de ${totalFiles}...`,
        currentFile: i + 1,
        totalFiles,
        currentFileName: file.name,
        progress: state.calculateOverallProgress(0, false),
      });

      try {
        const uploadId = `upl_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        if (worker) {
          const result = await new Promise((resolve, reject) => {
            const handleMessage = (e) => {
              const { type, uploadId: msgId, chunkSize, chunkIndex, result, error } = e.data;
              if (msgId !== uploadId) return;
              if (type === "CHUNK_PROGRESS") {
                state.addUploadedBytes(chunkSize);
                onProgress({
                  phase: "sending",
                  statusText: `Enviando ${file.name} (${chunkIndex + 1}/${totalChunks})...`,
                  currentFile: i + 1,
                  totalFiles,
                  currentFileName: file.name,
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
          successList.push({ file: file.name, result });
        } else {
          // Fallback sem Worker
          for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunkBlob = file.slice(start, end);
            const formData = new FormData();
            formData.append("uploadId", uploadId);
            formData.append("chunkIndex", chunkIndex);
            formData.append("totalChunks", totalChunks);
            formData.append("chunk", chunkBlob);
            const res = await fetch("/api/upload-chunk", { method: "POST", body: formData });
            if (!res.ok) throw new Error(`Falha no chunk ${chunkIndex + 1}`);
            state.addUploadedBytes(chunkBlob.size);
            onProgress({
              phase: "sending",
              statusText: `Enviando ${file.name} (${chunkIndex + 1}/${totalChunks})...`,
              currentFile: i + 1,
              totalFiles,
              currentFileName: file.name,
              progress: state.calculateOverallProgress(0, false),
            });
          }
          const completeRes = await fetch("/api/upload-complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uploadId,
              fileName: file.name,
              mimeType: file.type || "application/octet-stream",
              nome: guestName,
              totalChunks,
            }),
          });
          if (!completeRes.ok) throw new Error("Falha ao finalizar montagem");
          successList.push({ file: file.name, result: await completeRes.json() });
        }
      } catch (err) {
        console.error(`[Uploader] Falha no arquivo ${file.name}:`, err);
        failureList.push({ file: file.name, error: err.message });
      }
    }

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
      if (onSuccess) onSuccess({ successCount: successList.length, total: totalFiles });
    } else if (successList.length > 0) {
      onProgress({
        phase: "partial",
        statusText: `${successList.length} de ${totalFiles} mídias enviadas (${failureList.length} falharam).`,
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
      statusText: "Erro de conexão ao enviar mídias. Tente novamente.",
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
 * Função principal: Tenta Background Fetch primeiro, fallback para Web Worker
 */
export async function startResilientUpload(files, guestName, callbacks) {
  if (!files || files.length === 0) return;

  const { onProgress } = callbacks;

  // 1. Comprime todas as imagens primeiro (precisa do Canvas na main thread)
  const processedFiles = [];
  for (let i = 0; i < files.length; i++) {
    onProgress({
      phase: "optimizing",
      statusText: `Preparando ${files[i].name}...`,
      currentFile: i + 1,
      totalFiles: files.length,
      currentFileName: files[i].name,
      progress: Math.round((i / files.length) * 5),
    });
    processedFiles.push(await compressImage(files[i]));
  }

  // 2. Tenta Background Fetch API (funciona em segundo plano no Android)
  const bgFetchSupported = await supportsBackgroundFetch();
  
  if (bgFetchSupported) {
    console.log("[Uploader] ✅ Background Fetch API disponível — upload vai continuar mesmo fora do app");
    try {
      await uploadViaBackgroundFetch(processedFiles, guestName, callbacks);
      return;
    } catch (err) {
      console.warn("[Uploader] Background Fetch falhou, usando fallback:", err.message);
      // Cai para o fallback abaixo
    }
  } else {
    console.log("[Uploader] ⚠️ Background Fetch não disponível — usando Web Worker (upload pode pausar fora do app)");
  }

  // 3. Fallback: Web Worker + backgroundKeepAlive
  backgroundKeepAlive.start();
  await uploadViaFallback(processedFiles, guestName, callbacks);
}

/**
 * Verifica se há um upload em background pendente (para quando o usuário reabre o site)
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
      // Background fetch não existe mais — provavelmente já completou
      // Verifica o cache de estado do SW
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

    // Ainda em progresso
    if (bgFetch.result === "") {
      return {
        completed: false,
        bgFetch,
        totalFiles: data.totalFiles,
        id: data.id,
      };
    }

    // Já completou
    localStorage.removeItem("analu_bg_upload");
    return {
      completed: true,
      success: bgFetch.result === "success",
      totalFiles: data.totalFiles,
    };
  } catch (e) {
    console.warn("[Uploader] Erro ao verificar upload pendente:", e);
    localStorage.removeItem("analu_bg_upload");
    return null;
  }
}

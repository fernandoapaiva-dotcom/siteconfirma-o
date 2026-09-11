/**
 * Resilient Uploader Engine para Dispositivos Móveis e Desktop
 * - Streaming Pipeline: Comprime e inicia o envio imediatamente (sem travar em lote)
 * - Upload em Chunks de 1MB com verificação de status no servidor para retomada instantânea
 * - BackgroundKeepAlive com MediaSession ativa e WakeLock contínuo
 * - Resiliência à tela apagada / celular bloqueado com retomada automática em visibilitychange/pageshow
 */

import { backgroundKeepAlive } from "./backgroundKeepAlive.js";

const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB por chunk
const MAX_RETRIES_PER_REQUEST = 20; // 20 tentativas com tolerância para o celular no bolso
const REQUEST_TIMEOUT_MS = 60000; // 60s timeout

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
 * Espera uma condição (online ou documento visível) ou tempo determinado.
 * Se o usuário ligar a tela (visibilitychange -> visible) ou focar a aba, acorda imediatamente!
 */
function waitOnlineOrDelay(delayMs, onWakeup) {
  return new Promise((resolve) => {
    let timer = null;

    const handleResume = () => {
      cleanup();
      if (onWakeup) onWakeup();
      resolve();
    };

    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        handleResume();
      }
    };

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleResume);
        window.removeEventListener("pageshow", handleResume);
        window.removeEventListener("focus", handleResume);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleResume);
      window.addEventListener("pageshow", handleResume);
      window.addEventListener("focus", handleResume);
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);
  });
}

/**
 * Executa fetch com retentativa exponencial e resiliência à suspensão mobile.
 */
async function fetchWithRetry(url, options = {}, { maxRetries = MAX_RETRIES_PER_REQUEST, onStatusUpdate } = {}) {
  let attempt = 0;

  while (attempt < maxRetries) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (onStatusUpdate) {
        onStatusUpdate("Sem conexão à internet. Aguardando sinal...");
      }
      await waitOnlineOrDelay(60000);
      continue;
    }

    const controller = new AbortController();
    const isHidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    const timeoutMs = isHidden ? 90000 : REQUEST_TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        return res;
      }

      const isTransientServerErr = res.status >= 500 && res.status <= 504;
      if (!isTransientServerErr && res.status !== 408 && res.status !== 429) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      clearTimeout(timeoutId);

      // Se a tela estava desligada/bloqueada, não penaliza o contador de tentativas rapidamente
      const wasHidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      if (!wasHidden || attempt % 2 === 0) {
        attempt++;
      }

      if (attempt >= maxRetries) {
        throw new Error(`Falha após tentativas prolongadas: ${err.message}`);
      }

      const backoffMs = Math.min(800 * Math.pow(1.3, attempt), 5000) + Math.random() * 400;

      if (onStatusUpdate) {
        onStatusUpdate(
          wasHidden
            ? `Enviando em segundo plano (tentativa ${attempt + 1}/${maxRetries})...`
            : `Sinal oscilou. Retomando envio (tentativa ${attempt + 1}/${maxRetries})...`
        );
      }

      await waitOnlineOrDelay(backoffMs);
    }
  }
}

/**
 * Consulta quais chunks já estão no servidor para não reenviar pedaços repetidos
 */
async function checkServerChunkStatus(uploadId) {
  try {
    const res = await fetch(`/api/upload-status/${uploadId}`);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (e) {}
  return { exists: false, chunks: [] };
}

/**
 * Faz o upload de um único arquivo via Chunks com suporte a retomada inteligente
 */
async function uploadSingleFile(file, fileIndex, totalFiles, guestName, state, onProgressUpdate) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `upl_${Date.now()}_${fileIndex}_${Math.random().toString(36).substring(2, 7)}`;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunkBlob = file.slice(start, end);

    // Antes de reenviar chunk após reconexão, verifica se o servidor já o possui
    if (chunkIndex > 0) {
      const status = await checkServerChunkStatus(uploadId);
      if (status.exists && Array.isArray(status.chunks) && status.chunks.includes(chunkIndex)) {
        state.addUploadedBytes(chunkBlob.size);
        continue;
      }
    }

    const formData = new FormData();
    formData.append("uploadId", uploadId);
    formData.append("chunkIndex", chunkIndex);
    formData.append("totalChunks", totalChunks);
    formData.append("chunk", chunkBlob);

    await fetchWithRetry("/api/upload-chunk", {
      method: "POST",
      body: formData,
    }, {
      onStatusUpdate: (msg) => {
        onProgressUpdate({
          phase: "sending",
          statusText: msg,
          currentFile: fileIndex + 1,
          totalFiles,
          currentFileName: file.name,
          progress: state.calculateOverallProgress(chunkBlob.size, false),
        });
      },
    });

    state.addUploadedBytes(chunkBlob.size);
    onProgressUpdate({
      phase: "sending",
      statusText: `Enviando ${file.name} (${chunkIndex + 1}/${totalChunks})...`,
      currentFile: fileIndex + 1,
      totalFiles,
      currentFileName: file.name,
      progress: state.calculateOverallProgress(0, false),
    });
  }

  // Finaliza e monta o arquivo no servidor
  onProgressUpdate({
    phase: "sending",
    statusText: `Processando ${file.name} no servidor...`,
    currentFile: fileIndex + 1,
    totalFiles,
    currentFileName: file.name,
    progress: state.calculateOverallProgress(0, false),
  });

  const completeRes = await fetchWithRetry("/api/upload-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uploadId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      nome: guestName,
      totalChunks,
    }),
  }, {
    onStatusUpdate: (msg) => {
      onProgressUpdate({
        phase: "sending",
        statusText: msg,
        currentFile: fileIndex + 1,
        totalFiles,
        currentFileName: file.name,
        progress: state.calculateOverallProgress(0, false),
      });
    },
  });

  return await completeRes.json();
}

/**
 * Função principal: Inicia imediatamente o envio em streaming (processa e envia arquivo por arquivo)
 */
export async function startResilientUpload(files, guestName, { onProgress, onSuccess, onError }) {
  if (!files || files.length === 0) return;

  // Inicia o guardião de segundo plano com stream real e mediaSession
  backgroundKeepAlive.start();

  const beforeUnloadListener = (e) => {
    e.preventDefault();
    e.returnValue = "O envio das suas fotos ainda está em andamento. Deseja sair mesmo assim?";
    return e.returnValue;
  };
  window.addEventListener("beforeunload", beforeUnloadListener);

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

    // STREAMING PIPELINE: Processa e envia cada arquivo IMEDIATAMENTE (sem esperar lote)
    for (let i = 0; i < totalFiles; i++) {
      const rawFile = files[i];

      onProgress({
        phase: "optimizing",
        statusText: `Preparando ${rawFile.name}...`,
        currentFile: i + 1,
        totalFiles,
        currentFileName: rawFile.name,
        progress: state.calculateOverallProgress(0, false),
      });

      // Comprime a imagem imediatamente antes do envio (vídeos passam direto em milissegundos)
      const processedFile = await compressImage(rawFile);

      onProgress({
        phase: "sending",
        statusText: `Enviando arquivo ${i + 1} de ${totalFiles}...`,
        currentFile: i + 1,
        totalFiles,
        currentFileName: processedFile.name,
        progress: state.calculateOverallProgress(0, false),
      });

      try {
        const result = await uploadSingleFile(
          processedFile,
          i,
          totalFiles,
          guestName || "Convidado",
          state,
          onProgress
        );
        successList.push({ file: processedFile.name, result });
      } catch (err) {
        console.error(`[Uploader] Falha permanente no arquivo ${processedFile.name}:`, err);
        failureList.push({ file: processedFile.name, error: err.message });
      }
    }

    // Conclusão
    if (failureList.length === 0) {
      onProgress({
        phase: "done",
        statusText: totalFiles > 1
          ? `Todas as ${totalFiles} mídias foram enviadas com sucesso!`
          : "Mídia enviada com sucesso!",
        currentFile: totalFiles,
        totalFiles,
        currentFileName: "",
        progress: 100,
      });
      if (onSuccess) onSuccess({ successCount: successList.length, total: totalFiles });
    } else if (successList.length > 0) {
      onProgress({
        phase: "partial",
        statusText: `${successList.length} de ${totalFiles} mídias enviadas (${failureList.length} falharam).`,
        currentFile: totalFiles,
        totalFiles,
        currentFileName: "",
        progress: 100,
      });
      if (onSuccess) onSuccess({ successCount: successList.length, total: totalFiles, failures: failureList });
    } else {
      throw new Error("Não foi possível enviar as mídias. Verifique sua conexão.");
    }
  } catch (err) {
    console.error("[Uploader] Erro fatal:", err);
    onProgress({
      phase: "error",
      statusText: "Erro de conexão ao enviar mídias. Tente novamente.",
      currentFile: 0,
      totalFiles: files.length,
      currentFileName: "",
      progress: 0,
    });
    if (onError) onError(err);
  } finally {
    backgroundKeepAlive.stop();
    window.removeEventListener("beforeunload", beforeUnloadListener);
  }
}

/**
 * Resilient Uploader Engine para Dispositivos Móveis e Desktop
 * - Compressão inteligente de fotos no cliente antes do envio (reduz 10MB -> 500KB)
 * - Upload em Chunks de 2.5MB (ideal para conexões 3G/4G/5G)
 * - Retentativas automáticas exponenciais com detecção de perda de conexão
 * - Suporte a Screen Wake Lock API (evita que a tela apague durante o envio)
 * - Recuperação automática ao alternar entre abas/aplicativos (visibilitychange)
 * - Fila isolada por arquivo (se 1 arquivo falhar após várias tentativas, os outros continuam)
 */

const CHUNK_SIZE = 2.5 * 1024 * 1024; // 2.5MB por chunk
const MAX_RETRIES_PER_REQUEST = 8;
const REQUEST_TIMEOUT_MS = 45000; // 45s de timeout para não travar conexões zumbis

/**
 * Comprime imagens no navegador preservando alta qualidade visual.
 * Reduz enormemente o consumo de dados móveis e tempo de upload.
 */
export async function compressImage(file) {
  // Ignora vídeos ou arquivos muito pequenos
  const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|m4v|3gp|webm|avi)$/i.test(file.name);
  if (isVideo) return file;

  // Se já for menor que 400KB, envia direto
  if (file.size < 400 * 1024) return file;

  try {
    let sourceImage = null;

    if (typeof createImageBitmap === "function") {
      try {
        sourceImage = await createImageBitmap(file);
      } catch (e) {
        // Fallback para HTMLImageElement
      }
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
 * Espera uma condição (online ou documento visível) ou tempo determinado
 */
function waitOnlineOrDelay(delayMs, onWakeup) {
  return new Promise((resolve) => {
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", handleResume);
      document.removeEventListener("visibilitychange", handleResume);
    };

    const handleResume = () => {
      cleanup();
      if (onWakeup) onWakeup();
      resolve();
    };

    window.addEventListener("online", handleResume);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        handleResume();
      }
    });

    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);
  });
}

/**
 * Executa fetch com retentativa exponencial e resiliência à suspensão mobile
 */
async function fetchWithRetry(url, options = {}, { maxRetries = MAX_RETRIES_PER_REQUEST, onStatusUpdate } = {}) {
  let attempt = 0;

  while (attempt < maxRetries) {
    // Se estiver offline, aguarda a conexão voltar
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (onStatusUpdate) {
        onStatusUpdate("Sem conexão à internet. Aguardando sinal...");
      }
      await waitOnlineOrDelay(60000);
      continue;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        return res;
      }

      // Se o servidor respondeu 4xx ou 5xx
      const isTransientServerErr = res.status >= 500 && res.status <= 504;
      if (!isTransientServerErr && res.status !== 408 && res.status !== 429) {
        // Erro não transiente (ex: 400 ou 404), lança erro diretamente
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      clearTimeout(timeoutId);
      attempt++;

      const isAborted = controller.signal.aborted;
      const isNetworkError = err.name === "TypeError" || isAborted || /failed to fetch|networkerror|aborted|load failed/i.test(err.message);

      if (attempt >= maxRetries) {
        throw new Error(`Falha após ${maxRetries} tentativas: ${err.message}`);
      }

      const backoffMs = Math.min(1000 * Math.pow(1.5, attempt), 8000) + Math.random() * 500;

      if (onStatusUpdate) {
        onStatusUpdate(
          isNetworkError
            ? `Conexão instável. Retomando envio (tentativa ${attempt + 1}/${maxRetries})...`
            : `Aguardando servidor para continuar (tentativa ${attempt + 1}/${maxRetries})...`
        );
      }

      await waitOnlineOrDelay(backoffMs);
    }
  }
}

/**
 * Gerenciador de Screen Wake Lock para manter o celular acordado
 */
class WakeLockManager {
  constructor() {
    this.sentinel = null;
    this.isActive = false;
    this.handleVisibility = this.handleVisibility.bind(this);
  }

  async acquire() {
    this.isActive = true;
    document.addEventListener("visibilitychange", this.handleVisibility);
    await this.requestLock();
  }

  async requestLock() {
    if (!this.isActive || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      if (!this.sentinel || this.sentinel.released) {
        this.sentinel = await navigator.wakeLock.request("screen");
        this.sentinel.addEventListener("release", () => {
          this.sentinel = null;
        });
      }
    } catch (err) {
      // Ignora silenciosamente se o navegador rejeitar
    }
  }

  async handleVisibility() {
    if (document.visibilityState === "visible" && this.isActive) {
      await this.requestLock();
    }
  }

  release() {
    this.isActive = false;
    document.removeEventListener("visibilitychange", this.handleVisibility);
    if (this.sentinel) {
      this.sentinel.release().catch(() => {});
      this.sentinel = null;
    }
  }
}

/**
 * Faz o upload de um único arquivo via Chunks com proteção de retentativas
 */
async function uploadSingleFile(file, fileIndex, totalFiles, guestName, state, onProgressUpdate) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `upl_${Date.now()}_${fileIndex}_${Math.random().toString(36).substring(2, 7)}`;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunkBlob = file.slice(start, end);

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
      statusText: `Enviando arquivo ${fileIndex + 1} de ${totalFiles}...`,
      currentFile: fileIndex + 1,
      totalFiles,
      currentFileName: file.name,
      progress: state.calculateOverallProgress(0, false),
    });
  }

  // Finaliza e monta o arquivo no servidor
  onProgressUpdate({
    phase: "sending",
    statusText: `Processando arquivo ${fileIndex + 1} de ${totalFiles}...`,
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
 * Função principal que gerencia o upload de múltiplas mídias em segundo plano
 */
export async function startResilientUpload(files, guestName, { onProgress, onSuccess, onError }) {
  if (!files || files.length === 0) return;

  const wakeLock = new WakeLockManager();
  await wakeLock.acquire();

  // Proteção contra fechamento acidental da página durante o envio
  const beforeUnloadListener = (e) => {
    e.preventDefault();
    e.returnValue = "O envio das suas fotos ainda está em andamento. Deseja sair mesmo assim?";
    return e.returnValue;
  };
  window.addEventListener("beforeunload", beforeUnloadListener);

  try {
    // 1. Otimização prévia de imagens
    onProgress({
      phase: "optimizing",
      statusText: `Preparando ${files.length} arquivo(s) para envio rápido...`,
      currentFile: 1,
      totalFiles: files.length,
      currentFileName: files[0]?.name || "",
      progress: 2,
    });

    const processedFiles = [];
    for (let i = 0; i < files.length; i++) {
      onProgress({
        phase: "optimizing",
        statusText: `Otimizando arquivo ${i + 1} de ${files.length}...`,
        currentFile: i + 1,
        totalFiles: files.length,
        currentFileName: files[i].name,
        progress: Math.round(((i + 1) / files.length) * 8),
      });
      const optimized = await compressImage(files[i]);
      processedFiles.push(optimized);
    }

    const totalBatchBytes = processedFiles.reduce((acc, f) => acc + f.size, 0);

    const state = {
      uploadedBytes: 0,
      addUploadedBytes(bytes) {
        this.uploadedBytes += bytes;
      },
      calculateOverallProgress(additionalBytes = 0, isDone = false) {
        if (isDone) return 100;
        if (totalBatchBytes === 0) return 100;
        const raw = ((this.uploadedBytes + additionalBytes) / totalBatchBytes) * 92 + 8; // 8% a 100%
        return Math.min(Math.round(raw), 99);
      },
    };

    const successList = [];
    const failureList = [];

    // 2. Loop através dos arquivos
    for (let i = 0; i < processedFiles.length; i++) {
      const file = processedFiles[i];

      try {
        const result = await uploadSingleFile(
          file,
          i,
          processedFiles.length,
          guestName || "Convidado",
          state,
          onProgress
        );
        successList.push({ file: file.name, result });
      } catch (err) {
        console.error(`[Uploader] Falha permanente no envio do arquivo ${file.name}:`, err);
        failureList.push({ file: file.name, error: err.message });
      }
    }

    // 3. Conclusão
    if (failureList.length === 0) {
      onProgress({
        phase: "done",
        statusText: processedFiles.length > 1
          ? `Todas as ${processedFiles.length} mídias foram enviadas com sucesso!`
          : "Foto/vídeo enviado com sucesso!",
        currentFile: processedFiles.length,
        totalFiles: processedFiles.length,
        currentFileName: "",
        progress: 100,
      });
      if (onSuccess) onSuccess({ successCount: successList.length, total: processedFiles.length });
    } else if (successList.length > 0) {
      onProgress({
        phase: "partial",
        statusText: `${successList.length} de ${processedFiles.length} mídias enviadas (${failureList.length} falharam).`,
        currentFile: processedFiles.length,
        totalFiles: processedFiles.length,
        currentFileName: "",
        progress: 100,
      });
      if (onSuccess) onSuccess({ successCount: successList.length, total: processedFiles.length, failures: failureList });
    } else {
      throw new Error(`Não foi possível enviar as mídias. Verifique a internet e tente novamente.`);
    }
  } catch (err) {
    console.error("[Uploader] Erro fatal no upload:", err);
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
    wakeLock.release();
    window.removeEventListener("beforeunload", beforeUnloadListener);
  }
}

/**
 * Resilient Uploader Engine para Dispositivos Móveis e Desktop
 * - Thread Isolada via Web Worker (imune a congelamentos de abas em segundo plano)
 * - Streaming Pipeline: Comprime e inicia o envio imediatamente
 * - Upload em Chunks de 1MB com verificação de status no servidor
 * - BackgroundKeepAlive com MediaSession ativa e WakeLock contínuo
 */

import { backgroundKeepAlive } from "./backgroundKeepAlive.js";

const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB por chunk

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
 * Faz upload de arquivo utilizando o Web Worker isolado em segundo plano
 */
function uploadViaWorker(worker, file, uploadId, guestName, state, onProgressUpdate) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  return new Promise((resolve, reject) => {
    const handleMessage = (e) => {
      const { type, uploadId: msgUploadId, chunkSize, chunkIndex, result, error } = e.data;
      if (msgUploadId !== uploadId) return;

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
      payload: {
        file,
        uploadId,
        guestName,
        chunkSize: CHUNK_SIZE,
        totalChunks,
      },
    });
  });
}

/**
 * Fallback caso o navegador não suporte Web Worker
 */
async function uploadFallback(file, fileIndex, totalFiles, guestName, state, onProgressUpdate) {
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

    const res = await fetch("/api/upload-chunk", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Falha no chunk ${chunkIndex + 1}`);
    }

    state.addUploadedBytes(chunkBlob.size);
    onProgressUpdate({
      phase: "sending",
      statusText: `Enviando ${file.name} (${chunkIndex + 1}/${totalChunks})...`,
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
  return await completeRes.json();
}

/**
 * Função principal: Gerencia upload resiliente em segundo plano
 */
export async function startResilientUpload(files, guestName, { onProgress, onSuccess, onError }) {
  if (!files || files.length === 0) return;

  // Inicia guardião de segundo plano com áudio silencioso ativo no DOM e MediaSession
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
    console.warn("[Uploader] Web Worker não suportado, usando fallback:", err.message);
  }

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
        const uploadId = `upl_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;
        let result = null;

        if (worker) {
          result = await uploadViaWorker(
            worker,
            processedFile,
            uploadId,
            guestName || "Convidado",
            state,
            (progressData) => {
              onProgress({
                ...progressData,
                currentFile: i + 1,
                totalFiles,
                currentFileName: processedFile.name,
              });
            }
          );
        } else {
          result = await uploadFallback(
            processedFile,
            i,
            totalFiles,
            guestName || "Convidado",
            state,
            (progressData) => {
              onProgress({
                ...progressData,
                currentFile: i + 1,
                totalFiles,
                currentFileName: processedFile.name,
              });
            }
          );
        }

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
      throw new Error("Não foi possível concluir o envio das mídias. Verifique a internet e tente novamente.");
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
    if (worker) {
      try { worker.terminate(); } catch (e) {}
    }
    backgroundKeepAlive.stop();
    window.removeEventListener("beforeunload", beforeUnloadListener);
  }
}

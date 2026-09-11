/**
 * Upload Worker
 * Executa o loop de envio em chunks em uma thread isolada (Worker),
 * imune ao congelamento de renderização e timers da thread principal do DOM.
 * 
 * Resiliente a background:
 * - Timeouts estritos em cada fetch (12s) para nunca travar em sockets zumbis
 * - Consulta status do servidor antes de retransmitir pedaços já recebidos
 * - Retomada imediata sem perder progresso
 */

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === "UPLOAD_FILE") {
    const { file, uploadId, guestName, chunkSize, totalChunks } = payload;

    try {
      // 1. Antes de começar, consulta se algum chunk já foi enviado anteriormente
      let completedChunks = new Set();
      try {
        const checkRes = await fetch(`/api/upload-status/${uploadId}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.completed) {
            self.postMessage({
              type: "FILE_SUCCESS",
              uploadId,
              fileName: file.name,
              result: { alreadyCompleted: true },
            });
            return;
          }
          if (Array.isArray(checkData.chunks)) {
            completedChunks = new Set(checkData.chunks);
          }
        }
      } catch (ce) {}

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        // Se este chunk já chegou no servidor, apenas notifica progresso e avança
        if (completedChunks.has(chunkIndex)) {
          self.postMessage({
            type: "CHUNK_PROGRESS",
            uploadId,
            chunkIndex,
            totalChunks,
            chunkSize: chunk.size,
          });
          continue;
        }

        let success = false;
        let attempts = 0;

        while (!success && attempts < 25) {
          try {
            const formData = new FormData();
            formData.append("uploadId", uploadId);
            formData.append("chunkIndex", chunkIndex.toString());
            formData.append("totalChunks", totalChunks.toString());
            formData.append("fileName", file.name);
            formData.append("mimeType", file.type || "application/octet-stream");
            formData.append("nome", guestName || "Convidado");
            formData.append("chunk", chunk);

            const res = await fetch("/api/upload-chunk", {
              method: "POST",
              body: formData,
              signal: AbortSignal.timeout(15000), // Timeout de 15s para evitar socket zumbi
            });

            if (res.ok) {
              success = true;
              completedChunks.add(chunkIndex);
              self.postMessage({
                type: "CHUNK_PROGRESS",
                uploadId,
                chunkIndex,
                totalChunks,
                chunkSize: chunk.size,
              });
            } else {
              throw new Error(`HTTP ${res.status}`);
            }
          } catch (err) {
            attempts++;

            // Consulta se o chunk chegou apesar do erro/timeout
            try {
              const statusRes = await fetch(`/api/upload-status/${uploadId}`, {
                signal: AbortSignal.timeout(4000),
              });
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                if (
                  statusData.completed ||
                  (Array.isArray(statusData.chunks) && statusData.chunks.includes(chunkIndex))
                ) {
                  success = true;
                  completedChunks.add(chunkIndex);
                  self.postMessage({
                    type: "CHUNK_PROGRESS",
                    uploadId,
                    chunkIndex,
                    totalChunks,
                    chunkSize: chunk.size,
                  });
                  break;
                }
              }
            } catch (se) {}

            if (!success) {
              const waitMs = Math.min(500 * attempts, 3000);
              await new Promise((r) => setTimeout(r, waitMs));
            }
          }
        }

        if (!success) {
          throw new Error(`Não foi possível enviar o pedaço ${chunkIndex + 1} de ${file.name}`);
        }
      }

      // Finaliza e monta o arquivo no servidor
      let completed = false;
      let completeAttempts = 0;
      let completeData = null;

      while (!completed && completeAttempts < 15) {
        try {
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
            signal: AbortSignal.timeout(45000), // 45s para montagem e Drive upload
          });

          if (completeRes.ok) {
            completeData = await completeRes.json();
            completed = true;
          } else {
            throw new Error(`Status ${completeRes.status}`);
          }
        } catch (compErr) {
          completeAttempts++;
          // Checa se o servidor já concluiu
          try {
            const checkRes = await fetch(`/api/upload-status/${uploadId}`, {
              signal: AbortSignal.timeout(4000),
            });
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              if (checkData.completed) {
                completed = true;
                completeData = { ok: true, alreadyCompleted: true };
                break;
              }
            }
          } catch (e) {}

          if (!completed) {
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
      }

      if (!completed) {
        throw new Error(`Falha ao concluir montagem de ${file.name}`);
      }

      self.postMessage({
        type: "FILE_SUCCESS",
        uploadId,
        fileName: file.name,
        result: completeData,
      });
    } catch (err) {
      self.postMessage({
        type: "FILE_ERROR",
        uploadId,
        fileName: file.name,
        error: err.message,
      });
    }
  }
};

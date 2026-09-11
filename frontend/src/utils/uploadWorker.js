/**
 * Upload Worker
 * Executa o loop de envio em chunks em uma thread isolada (Worker),
 * imune ao congelamento de renderização e timers da thread principal do DOM
 * quando a aba fica oculta ou o usuário minimiza o navegador.
 */

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === "UPLOAD_FILE") {
    const { file, uploadId, guestName, chunkSize, totalChunks } = payload;

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        let success = false;
        let attempts = 0;

        while (!success && attempts < 20) {
          try {
            const formData = new FormData();
            formData.append("uploadId", uploadId);
            formData.append("chunkIndex", chunkIndex);
            formData.append("totalChunks", totalChunks);
            formData.append("chunk", chunk);

            const res = await fetch("/api/upload-chunk", {
              method: "POST",
              body: formData,
            });

            if (res.ok) {
              success = true;
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

            // Consulta se o chunk já chegou apesar da oscilação de rede
            try {
              const checkRes = await fetch(`/api/upload-status/${uploadId}`);
              if (checkRes.ok) {
                const checkData = await checkRes.json();
                if (checkData.exists && Array.isArray(checkData.chunks) && checkData.chunks.includes(chunkIndex)) {
                  success = true;
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
            } catch (ce) {}

            if (!success) {
              const waitMs = Math.min(600 * attempts, 4000);
              await new Promise((resolve) => setTimeout(resolve, waitMs));
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

      while (!completed && completeAttempts < 10) {
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
          });

          if (completeRes.ok) {
            completeData = await completeRes.json();
            completed = true;
          } else {
            throw new Error(`Status ${completeRes.status}`);
          }
        } catch (compErr) {
          completeAttempts++;
          await new Promise((resolve) => setTimeout(resolve, 1500));
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

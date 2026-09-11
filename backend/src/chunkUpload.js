import fs from "node:fs";
import path from "node:path";
import { getAvailableDriveClient, isMockMode } from "./driveManager.js";
import { saveToGalleryDb, getOrCreateUserFolder } from "./driveUpload.js";

const TEMP_DIR = path.resolve("./data/temp_chunks");

// Cache em memória de uploads recém-concluídos para idempotência (evita erro 404 em retries de rede)
const completedUploads = new Map(); // uploadId -> { file, timestamp }
const pendingAssemblies = new Map(); // uploadId -> Promise

// Limpa cache mais antigo que 30 minutos a cada 10 minutos
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of completedUploads.entries()) {
    if (now - data.timestamp > 30 * 60 * 1000) {
      completedUploads.delete(id);
    }
  }
}, 10 * 60 * 1000).unref();

export async function handleChunkUpload(req, res) {
  try {
    const { uploadId, chunkIndex, totalChunks } = req.body;
    const file = req.file;

    if (!uploadId || chunkIndex === undefined || totalChunks === undefined || !file) {
      return res.status(400).json({ error: "Parâmetros de chunk ausentes." });
    }

    const uploadDir = path.join(TEMP_DIR, uploadId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const chunkPath = path.join(uploadDir, chunkIndex.toString());
    fs.writeFileSync(chunkPath, file.buffer);

    res.json({ ok: true, chunkIndex: parseInt(chunkIndex, 10), size: file.size });
  } catch (err) {
    console.error("Erro no upload do chunk:", err);
    res.status(500).json({ error: "Falha ao salvar chunk" });
  }
}

export async function handleChunkComplete(req, res) {
  try {
    const { uploadId, fileName, mimeType, nome, totalChunks } = req.body;
    
    if (!uploadId || !fileName || !mimeType) {
      return res.status(400).json({ error: "Faltam parâmetros" });
    }

    // 1. Se já foi concluído anteriormente (ex: cliente reenviou por instabilidade na resposta)
    if (completedUploads.has(uploadId)) {
      const cached = completedUploads.get(uploadId);
      console.log(`[ChunkUpload] Upload ${uploadId} já processado anteriormente. Retornando cache com sucesso.`);
      return res.json({ ok: true, file: cached.file, alreadyCompleted: true });
    }

    // 2. Se está sendo montado/enviado no momento por requisição paralela
    if (pendingAssemblies.has(uploadId)) {
      console.log(`[ChunkUpload] Upload ${uploadId} já está em processamento. Aguardando conclusão...`);
      const result = await pendingAssemblies.get(uploadId);
      return res.json(result);
    }

    const uploadDir = path.join(TEMP_DIR, uploadId);
    if (!fs.existsSync(uploadDir)) {
      return res.status(404).json({ error: "UploadId não encontrado." });
    }

    // Valida se todos os chunks esperados estão presentes
    const existingChunks = fs.readdirSync(uploadDir);
    if (totalChunks !== undefined) {
      const expectedTotal = parseInt(totalChunks, 10);
      const missing = [];
      for (let i = 0; i < expectedTotal; i++) {
        if (!existingChunks.includes(i.toString())) {
          missing.push(i);
        }
      }
      if (missing.length > 0) {
        console.warn(`[ChunkUpload] Chunks ausentes para ${uploadId}:`, missing);
        return res.status(400).json({ error: "missing_chunks", missing });
      }
    }

    const assemblyPromise = (async () => {
      const chunks = fs.readdirSync(uploadDir).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
      const assembledPath = path.join(TEMP_DIR, `${uploadId}_${fileName}`);
      
      // Monta os chunks
      const writeStream = fs.createWriteStream(assembledPath);
      for (const chunkFile of chunks) {
        const chunkData = fs.readFileSync(path.join(uploadDir, chunkFile));
        writeStream.write(chunkData);
      }
      writeStream.end();

      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      // Envia para o Drive
      const result = await streamFileToDrive(assembledPath, fileName, mimeType, nome || "Convidado");

      // Limpa os arquivos temporários SOMENTE após o sucesso confirmado
      try {
        if (fs.existsSync(assembledPath)) fs.unlinkSync(assembledPath);
        fs.rmSync(uploadDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.warn("[ChunkUpload] Erro ao limpar arquivos temporários:", cleanupErr.message);
      }

      const responsePayload = { ok: true, file: result };
      completedUploads.set(uploadId, { file: result, timestamp: Date.now() });
      return responsePayload;
    })();

    pendingAssemblies.set(uploadId, assemblyPromise);

    try {
      const responsePayload = await assemblyPromise;
      res.json(responsePayload);
    } finally {
      pendingAssemblies.delete(uploadId);
    }
  } catch (err) {
    console.error("Erro no chunk complete:", err);
    res.status(500).json({ error: "Falha ao processar arquivo completo" });
  }
}

async function streamFileToDrive(filePath, originalName, mimeType, guestName) {
  const safeName = guestName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();

  const timestamp = Date.now();
  const fileName = `${safeName}-${timestamp}-${originalName}`;

  if (isMockMode()) {
    const mockDir = path.resolve("./data/uploads");
    if (!fs.existsSync(mockDir)) fs.mkdirSync(mockDir, { recursive: true });
    fs.copyFileSync(filePath, path.join(mockDir, fileName));
    const publicUrl = `/api/uploads/${fileName}`;
    saveToGalleryDb({
      id: `mock-${timestamp}`,
      uploaderName: guestName,
      fileUrl: publicUrl,
      thumbnailUrl: publicUrl,
      timestamp,
      mimeType
    });
    return { webViewLink: publicUrl };
  }

  const driveInfo = await getAvailableDriveClient();
  const { drive, folderId: rootFolderId } = driveInfo;

  // Usa subpasta do convidado organizada dentro do Drive
  const userFolderId = await getOrCreateUserFolder(drive, rootFolderId, guestName || "Convidado");

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [userFolderId],
    },
    media: {
      mimeType,
      body: fs.createReadStream(filePath),
    },
    fields: "id, name, webViewLink, webContentLink, thumbnailLink",
  });

  const fileId = response.data.id;

  await drive.permissions.create({
    fileId: fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  saveToGalleryDb({
    id: fileId,
    uploaderName: guestName,
    fileUrl: response.data.webContentLink || response.data.webViewLink,
    thumbnailUrl: response.data.thumbnailLink || response.data.webContentLink,
    timestamp,
    mimeType
  });

  return response.data;
}

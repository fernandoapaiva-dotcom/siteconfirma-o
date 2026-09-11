import fs from "node:fs";
import path from "node:path";
import { getAvailableDriveClient, isMockMode } from "./driveManager.js";
import { saveToGalleryDb, getOrCreateUserFolder } from "./driveUpload.js";

const TEMP_DIR = path.resolve("./data/temp_chunks");

// Cache em memória de uploads recém-concluídos para idempotência (evita reprocessamento e race conditions)
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

/**
 * Função centralizada e segura de montagem de chunks e envio ao Google Drive
 */
export async function assembleUpload(uploadId, fileName, mimeType, nome, totalChunks) {
  if (completedUploads.has(uploadId)) {
    return completedUploads.get(uploadId).file;
  }

  if (pendingAssemblies.has(uploadId)) {
    return await pendingAssemblies.get(uploadId);
  }

  const uploadDir = path.join(TEMP_DIR, uploadId);
  if (!fs.existsSync(uploadDir)) {
    throw new Error("Diretório de chunks não encontrado");
  }

  const assemblyPromise = (async () => {
    const chunkFiles = fs.readdirSync(uploadDir).filter((f) => /^\d+$/.test(f));
    chunkFiles.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    if (totalChunks !== undefined) {
      const expected = parseInt(totalChunks, 10);
      if (chunkFiles.length < expected) {
        throw new Error(`Chunks incompletos: ${chunkFiles.length}/${expected}`);
      }
    }

    const safeFileName = fileName || "arquivo";
    const assembledPath = path.join(TEMP_DIR, `${uploadId}_${safeFileName}`);
    const writeStream = fs.createWriteStream(assembledPath);

    for (const chunkFile of chunkFiles) {
      const chunkData = fs.readFileSync(path.join(uploadDir, chunkFile));
      writeStream.write(chunkData);
    }
    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    const result = await streamFileToDrive(
      assembledPath,
      safeFileName,
      mimeType || "application/octet-stream",
      nome || "Convidado"
    );

    try {
      if (fs.existsSync(assembledPath)) fs.unlinkSync(assembledPath);
      fs.rmSync(uploadDir, { recursive: true, force: true });
    } catch (e) {
      console.warn("[ChunkUpload] Aviso ao limpar temporários:", e.message);
    }

    completedUploads.set(uploadId, { file: result, timestamp: Date.now() });
    return result;
  })();

  pendingAssemblies.set(uploadId, assemblyPromise);
  try {
    return await assemblyPromise;
  } finally {
    pendingAssemblies.delete(uploadId);
  }
}

export async function handleChunkUpload(req, res) {
  try {
    const { uploadId, chunkIndex, totalChunks, fileName, mimeType, nome } = req.body;
    const file = req.file;

    if (!uploadId || chunkIndex === undefined || totalChunks === undefined || !file) {
      return res.status(400).json({ error: "Parâmetros de chunk ausentes." });
    }

    // Se este upload já foi completamente processado
    if (completedUploads.has(uploadId)) {
      return res.json({ ok: true, chunkIndex: parseInt(chunkIndex, 10), alreadyDone: true });
    }

    const uploadDir = path.join(TEMP_DIR, uploadId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Salva metadados para caso o auto-assembly precise montar sem requisição extra
    if (fileName) {
      const metaPath = path.join(uploadDir, "meta.json");
      if (!fs.existsSync(metaPath)) {
        try {
          fs.writeFileSync(
            metaPath,
            JSON.stringify({ uploadId, fileName, mimeType, nome, totalChunks }),
            "utf8"
          );
        } catch (e) {}
      }
    }

    const chunkPath = path.join(uploadDir, chunkIndex.toString());
    fs.writeFileSync(chunkPath, file.buffer);

    const expectedTotal = parseInt(totalChunks, 10);
    const savedChunks = fs.readdirSync(uploadDir).filter((f) => /^\d+$/.test(f));

    // Se todos os chunks já chegaram no servidor, dispara montagem e upload pro Drive automaticamente!
    if (savedChunks.length === expectedTotal && fileName) {
      console.log(`[ChunkUpload] Todos os ${expectedTotal} chunks de ${fileName} recebidos! Iniciando montagem automática...`);
      assembleUpload(uploadId, fileName, mimeType, nome, expectedTotal).catch((err) => {
        console.error(`[ChunkUpload] Falha na auto-montagem de ${uploadId}:`, err.message);
      });
    }

    res.json({
      ok: true,
      chunkIndex: parseInt(chunkIndex, 10),
      size: file.size,
      receivedChunks: savedChunks.length,
      totalChunks: expectedTotal,
    });
  } catch (err) {
    console.error("Erro no upload do chunk:", err);
    res.status(500).json({ error: "Falha ao salvar chunk" });
  }
}

export function handleChunkStatus(req, res) {
  try {
    const { uploadId } = req.params;
    if (!uploadId) return res.status(400).json({ error: "UploadId obrigatório" });

    if (completedUploads.has(uploadId)) {
      return res.json({ completed: true, chunks: [] });
    }

    const uploadDir = path.join(TEMP_DIR, uploadId);
    if (!fs.existsSync(uploadDir)) {
      return res.json({ exists: false, chunks: [] });
    }

    const files = fs.readdirSync(uploadDir);
    const chunks = files.map((f) => parseInt(f, 10)).filter((n) => !isNaN(n));
    res.json({ exists: true, chunks });
  } catch (err) {
    console.error("Erro ao verificar status do chunk:", err);
    res.status(500).json({ error: "Falha ao verificar status" });
  }
}

export async function handleChunkComplete(req, res) {
  try {
    const { uploadId, fileName, mimeType, nome, totalChunks } = req.body;

    if (!uploadId) {
      return res.status(400).json({ error: "Faltam parâmetros" });
    }

    // Se já finalizado
    if (completedUploads.has(uploadId)) {
      const cached = completedUploads.get(uploadId);
      return res.json({ ok: true, file: cached.file, alreadyCompleted: true });
    }

    const uploadDir = path.join(TEMP_DIR, uploadId);
    let resolvedFileName = fileName;
    let resolvedMimeType = mimeType;
    let resolvedNome = nome;
    let resolvedTotal = totalChunks;

    // Tenta recuperar metadados se não enviados nesta requisição
    if (fs.existsSync(path.join(uploadDir, "meta.json"))) {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(uploadDir, "meta.json"), "utf8"));
        resolvedFileName = resolvedFileName || meta.fileName;
        resolvedMimeType = resolvedMimeType || meta.mimeType;
        resolvedNome = resolvedNome || meta.nome;
        resolvedTotal = resolvedTotal || meta.totalChunks;
      } catch (e) {}
    }

    if (!resolvedFileName) {
      return res.status(400).json({ error: "fileName não informado" });
    }

    const file = await assembleUpload(
      uploadId,
      resolvedFileName,
      resolvedMimeType,
      resolvedNome,
      resolvedTotal
    );

    res.json({ ok: true, file });
  } catch (err) {
    console.error("Erro no chunk complete:", err);
    res.status(500).json({ error: err.message || "Falha ao processar arquivo completo" });
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
      mimeType,
    });
    return { webViewLink: publicUrl };
  }

  const driveInfo = await getAvailableDriveClient();
  const { drive, folderId: rootFolderId } = driveInfo;

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
    mimeType,
  });

  return response.data;
}

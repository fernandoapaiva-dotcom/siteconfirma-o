import fs from "node:fs";
import path from "node:path";
import { getAvailableDriveClient, isMockMode } from "./driveManager.js";
import { saveToGalleryDb } from "./driveUpload.js"; // Export saveToGalleryDb from driveUpload.js!

const TEMP_DIR = path.resolve("./data/temp_chunks");

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

    res.json({ ok: true, chunkIndex });
  } catch (err) {
    console.error("Erro no upload do chunk:", err);
    res.status(500).json({ error: "Falha ao salvar chunk" });
  }
}

export async function handleChunkComplete(req, res) {
  try {
    const { uploadId, fileName, mimeType, nome } = req.body;
    
    if (!uploadId || !fileName || !mimeType) {
      return res.status(400).json({ error: "Faltam parâmetros" });
    }

    const uploadDir = path.join(TEMP_DIR, uploadId);
    if (!fs.existsSync(uploadDir)) {
      return res.status(404).json({ error: "UploadId não encontrado." });
    }

    const chunks = fs.readdirSync(uploadDir).sort((a, b) => parseInt(a) - parseInt(b));
    const assembledPath = path.join(TEMP_DIR, `${uploadId}_${fileName}`);
    
    // Assemble chunks
    const writeStream = fs.createWriteStream(assembledPath);
    for (const chunkFile of chunks) {
      const chunkData = fs.readFileSync(path.join(uploadDir, chunkFile));
      writeStream.write(chunkData);
    }
    writeStream.end();

    await new Promise((resolve) => writeStream.on('finish', resolve));

    // Remove chunk dir
    fs.rmSync(uploadDir, { recursive: true, force: true });

    // Enviar para o drive
    const result = await streamFileToDrive(assembledPath, fileName, mimeType, nome || "Convidado");

    // Limpa o arquivo montado temporário
    fs.unlinkSync(assembledPath);

    res.json({ ok: true, file: result });
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

  const { drive, folderId } = await getAvailableDriveClient();

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
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

import { Readable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getAvailableDriveClient, isMockMode } from "./driveManager.js";

const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 82;
const MOCK_UPLOAD_DIR = path.resolve("./data/uploads");
const GALLERY_DB_PATH = path.resolve("./data/gallery.json");

/**
 * Redimensiona e corrige a orientação de uma imagem antes de subir.
 */
async function normalizeImage(file) {
  if (!file.mimetype.startsWith("image/")) {
    return { buffer: file.buffer, mimeType: file.mimetype, name: file.originalname };
  }

  try {
    const buffer = await sharp(file.buffer)
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();

    const nameSemExtensao = file.originalname.replace(/\.[^.]+$/, "");
    return { buffer, mimeType: "image/jpeg", name: `${nameSemExtensao}.jpg` };
  } catch (err) {
    console.warn("Não foi possível redimensionar, enviando original:", err.message);
    return { buffer: file.buffer, mimeType: file.mimetype, name: file.originalname };
  }
}

/**
 * Salva metadados da foto para a galeria
 */
export function saveToGalleryDb(photoData) {
  let gallery = [];
  if (fs.existsSync(GALLERY_DB_PATH)) {
    try {
      gallery = JSON.parse(fs.readFileSync(GALLERY_DB_PATH, "utf8"));
    } catch (e) {
      console.error("Erro ao ler gallery.json:", e);
    }
  }
  
  gallery.push(photoData);
  
  fs.writeFileSync(GALLERY_DB_PATH, JSON.stringify(gallery, null, 2));
}

/**
 * Envia um arquivo para o Google Drive configurado (com fallback de conta).
 * @param {Express.Multer.File} file
 * @param {string} guestName - usado para nomear o arquivo de forma organizada
 */
export async function uploadPhotoToDrive(file, guestName) {
  const normalized = await normalizeImage(file);
  const uploaderName = guestName || "Convidado";

  const safeName = uploaderName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();

  const timestamp = Date.now();
  const fileName = `${safeName}-${timestamp}-${normalized.name}`;

  if (isMockMode()) {
    if (!fs.existsSync(MOCK_UPLOAD_DIR)) {
      fs.mkdirSync(MOCK_UPLOAD_DIR, { recursive: true });
    }
    const destPath = path.join(MOCK_UPLOAD_DIR, fileName);
    fs.writeFileSync(destPath, normalized.buffer);

    const publicUrl = `/api/uploads/${fileName}`;

    saveToGalleryDb({
      id: `mock-${timestamp}`,
      uploaderName,
      fileUrl: publicUrl,
      thumbnailUrl: publicUrl,
      timestamp,
      mimeType: normalized.mimeType
    });

    return {
      id: `mock-${timestamp}`,
      name: fileName,
      webViewLink: publicUrl,
    };
  }

  // Pega uma conta do Drive que tenha espaço disponível (Round-Robin Fallback)
  const driveInfo = await getAvailableDriveClient();
  const { drive, folderId } = driveInfo;

  // Faz o upload
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: normalized.mimeType,
      body: Readable.from(normalized.buffer),
    },
    fields: "id, name, webViewLink, webContentLink, thumbnailLink",
  });

  const fileId = response.data.id;

  // Torna o arquivo público para visualização no site
  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  // Salva no banco da Galeria local
  saveToGalleryDb({
    id: fileId,
    uploaderName,
    fileUrl: response.data.webContentLink || response.data.webViewLink,
    thumbnailUrl: response.data.thumbnailLink || response.data.webContentLink,
    timestamp,
    mimeType: normalized.mimeType
  });

  return response.data;
}

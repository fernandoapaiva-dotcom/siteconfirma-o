import { Readable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getAvailableDriveClient, isMockMode } from "./driveManager.js";

const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 82;
const MOCK_UPLOAD_DIR = path.resolve("./data/uploads");
const GALLERY_DB_PATH = path.resolve("./data/gallery.json");
const FOLDER_CACHE_PATH = path.resolve("./data/drive_folders.json");

async function normalizeImage(file) {
  if (!file.mimetype.startsWith("image/")) {
    return { buffer: file.buffer, mimeType: file.mimetype, name: file.originalname };
  }
  try {
    const buffer = await sharp(file.buffer)
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    const nameSemExtensao = file.originalname.replace(/\.[^.]+$/, "");
    return { buffer, mimeType: "image/jpeg", name: `${nameSemExtensao}.jpg` };
  } catch (err) {
    console.warn("Nao foi possivel redimensionar, enviando original:", err.message);
    return { buffer: file.buffer, mimeType: file.mimetype, name: file.originalname };
  }
}

export function saveToGalleryDb(photoData) {
  let gallery = [];
  if (fs.existsSync(GALLERY_DB_PATH)) {
    try { gallery = JSON.parse(fs.readFileSync(GALLERY_DB_PATH, "utf8")); } catch (e) {}
  }
  gallery.push(photoData);
  fs.writeFileSync(GALLERY_DB_PATH, JSON.stringify(gallery, null, 2));
}

function loadFolderCache() {
  if (fs.existsSync(FOLDER_CACHE_PATH)) {
    try { return JSON.parse(fs.readFileSync(FOLDER_CACHE_PATH, "utf8")); } catch(e) {}
  }
  return {};
}

function saveFolderCache(cache) {
  fs.writeFileSync(FOLDER_CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function getOrCreateUserFolder(drive, parentFolderId, uploaderName) {
  const cache = loadFolderCache();
  const cacheKey = parentFolderId + "::" + uploaderName;
  if (cache[cacheKey]) return cache[cacheKey];

  // Procura pasta existente no Drive com esse nome dentro do folder pai
  try {
    const search = await drive.files.list({
      q: `name='${uploaderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    });
    if (search.data.files && search.data.files.length > 0) {
      const folderId = search.data.files[0].id;
      cache[cacheKey] = folderId;
      saveFolderCache(cache);
      return folderId;
    }
  } catch(e) {
    console.warn("Erro ao buscar pasta do usuario:", e.message);
  }

  // Cria a pasta
  const folder = await drive.files.create({
    requestBody: {
      name: uploaderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id",
  });

  // Torna a pasta publica (leitura)
  await drive.permissions.create({
    fileId: folder.data.id,
    requestBody: { role: "reader", type: "anyone" },
  });

  const folderId = folder.data.id;
  cache[cacheKey] = folderId;
  saveFolderCache(cache);
  console.log(`[DriveUpload] Pasta criada para ${uploaderName}: ${folderId}`);
  return folderId;
}

export async function uploadPhotoToDrive(file, guestName) {
  const normalized = await normalizeImage(file);
  const uploaderName = (guestName || "Convidado").trim();

  const safeName = uploaderName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();

  const timestamp = Date.now();
  const fileName = `${safeName}-${timestamp}-${normalized.name}`;

  if (isMockMode()) {
    if (!fs.existsSync(MOCK_UPLOAD_DIR)) fs.mkdirSync(MOCK_UPLOAD_DIR, { recursive: true });
    const destPath = path.join(MOCK_UPLOAD_DIR, fileName);
    fs.writeFileSync(destPath, normalized.buffer);
    const publicUrl = `/api/uploads/${fileName}`;
    saveToGalleryDb({ id: `mock-${timestamp}`, uploaderName, fileUrl: publicUrl, thumbnailUrl: publicUrl, timestamp, mimeType: normalized.mimeType });
    return { id: `mock-${timestamp}`, name: fileName, webViewLink: publicUrl };
  }

  const driveInfo = await getAvailableDriveClient();
  const { drive, folderId: rootFolderId } = driveInfo;

  // Cria ou recupera pasta do usuario dentro do folder raiz
  const userFolderId = await getOrCreateUserFolder(drive, rootFolderId, uploaderName);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [userFolderId],
    },
    media: {
      mimeType: normalized.mimeType,
      body: Readable.from(normalized.buffer),
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
    uploaderName,
    fileUrl: response.data.webContentLink || response.data.webViewLink,
    thumbnailUrl: response.data.thumbnailLink || response.data.webContentLink,
    timestamp,
    mimeType: normalized.mimeType
  });

  return response.data;
}
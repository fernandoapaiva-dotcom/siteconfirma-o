import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";

const CONFIG_PATH = path.resolve("./data/drive_config.json");
const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"];

export function getDriveConfigList() {
  let configList = [];
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      configList = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch (e) {
      console.error("Erro ao ler drive_config.json:", e);
    }
  }

  // Se a lista estiver vazia (ou nÃ£o existir arquivo), adiciona a padrÃ£o do .env se existir
  const defaultKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./service-account.json";
  if (configList.length === 0 && process.env.DRIVE_FOLDER_ID && fs.existsSync(path.resolve(defaultKeyPath))) {
    configList.push({
      id: "default",
      keyPath: defaultKeyPath,
      folderId: process.env.DRIVE_FOLDER_ID
    });
  }
  
  return configList;
}

export function isMockMode() {
  return getDriveConfigList().length === 0;
}

// Retorna uma conta que ainda tenha espaÃ§o disponÃ­vel
export async function getAvailableDriveClient() {
  const accounts = getDriveConfigList();
  
  if (accounts.length === 0) {
    return null; // Mock mode
  }

  for (const account of accounts) {
    let drive;
    
    // Suporte para OAuth2 (Client ID / Secret / Refresh Token)
    if (account.clientId && account.clientSecret && account.refreshToken) {
      const oauth2Client = new google.auth.OAuth2(account.clientId, account.clientSecret);
      oauth2Client.setCredentials({ refresh_token: account.refreshToken });
      drive = google.drive({ version: "v3", auth: oauth2Client });
    } 
    // Suporte para Service Account tradicional (pode não ter cota em contas gmail gratuitas)
    else if (account.keyPath) {
      const auth = new google.auth.GoogleAuth({
        keyFile: path.resolve(account.keyPath),
        scopes: DRIVE_SCOPES,
      });
      drive = google.drive({ version: "v3", auth });
    } else {
      continue;
    }
    
    try {
      const res = await drive.about.get({ fields: "storageQuota" });
      const limit = parseInt(res.data.storageQuota.limit, 10);
      const usage = parseInt(res.data.storageQuota.usage, 10);
      
      // Contas Service Account gratuitas podem retornar limit nulo, vamos tentar usar de qualquer forma,
      // mas se der erro de quota no upload ele vai falhar.
      if (!limit || (limit - usage > 200 * 1024 * 1024)) {
         return { drive, folderId: account.folderId, accountId: account.id };
      } else {
         console.warn(`[DriveManager] A conta ${account.id} atingiu a cota limite! Pulando para a próxima...`);
      }
    } catch (err) {
      console.error(`[DriveManager] Erro ao verificar cota da conta ${account.id}:`, err.message);
      continue;
    }
  }
  
  throw new Error("Todas as contas de Google Drive cadastradas estão cheias ou indisponíveis.");
}

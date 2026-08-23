import { google } from "googleapis";
import path from "node:path";
import fs from "node:fs";

// Uma única conta de serviço autentica tanto o Drive (fotos)
// quanto o Sheets (confirmações). Os escopos abaixo são o mínimo
// necessário para cada API.
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
];

let cachedAuth = null;

export function isMockMode() {
  const keyPath = path.resolve(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./service-account.json"
  );
  const keyExists = fs.existsSync(keyPath);
  const hasSheetId = !!process.env.SHEET_ID;
  const hasDriveId = !!process.env.DRIVE_FOLDER_ID;

  // Se faltar o arquivo de chave OU as IDs do Drive/Sheets, assume Mock Mode.
  return !keyExists || !hasSheetId || !hasDriveId;
}

export function getGoogleAuth() {
  if (isMockMode()) {
    return null;
  }
  if (cachedAuth) return cachedAuth;

  const keyPath = path.resolve(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./service-account.json"
  );

  cachedAuth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: SCOPES,
  });

  return cachedAuth;
}

export async function getDriveClient() {
  const auth = getGoogleAuth();
  return google.drive({ version: "v3", auth: await auth.getClient() });
}

export async function getSheetsClient() {
  const auth = getGoogleAuth();
  return google.sheets({ version: "v4", auth: await auth.getClient() });
}

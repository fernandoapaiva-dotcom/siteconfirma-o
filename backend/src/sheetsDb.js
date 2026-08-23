import fs from "node:fs";
import path from "node:path";
import { getSheetsClient, isMockMode } from "./googleAuth.js";

const SHEET_ID = () => process.env.SHEET_ID;
const TAB = () => process.env.SHEET_TAB || "Confirmacoes";

const MOCK_FILE_PATH = path.resolve("./data/confirmations.json");

function ensureDirectoryExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Colunas da planilha, nessa ordem. A primeira linha da aba deve
// ter esses mesmos títulos (crie manualmente antes de usar).
// data | nome | acompanhantes | vai_ao_almoco | mensagem

export async function addConfirmation({ nome, acompanhantes, presenca, mensagem }) {
  if (isMockMode()) {
    ensureDirectoryExists(MOCK_FILE_PATH);
    let data = [];
    if (fs.existsSync(MOCK_FILE_PATH)) {
      try {
        data = JSON.parse(fs.readFileSync(MOCK_FILE_PATH, "utf-8"));
      } catch (e) {
        data = [];
      }
    }
    const newConfirmation = {
      data: new Date().toISOString(),
      nome,
      acompanhantes: acompanhantes ?? 0,
      presenca,
      mensagem: mensagem || "",
    };
    data.push(newConfirmation);
    fs.writeFileSync(MOCK_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
    return newConfirmation;
  }

  const sheets = await getSheetsClient();

  const row = [
    new Date().toISOString(),
    nome,
    acompanhantes ?? 0,
    presenca,
    mensagem || "",
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: `${TAB()}!A:E`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  return { nome, acompanhantes, presenca, mensagem };
}

export async function listConfirmations() {
  if (isMockMode()) {
    if (!fs.existsSync(MOCK_FILE_PATH)) return [];
    try {
      const items = JSON.parse(fs.readFileSync(MOCK_FILE_PATH, "utf-8"));
      return items.map((item) => {
        let presenca = item.presenca;
        if (typeof presenca === "undefined" && typeof item.vaiAoAlmoco !== "undefined") {
          presenca = item.vaiAoAlmoco ? "Cerimônia e Almoço" : "Não poderei comparecer";
        }
        return {
          data: item.data,
          nome: item.nome,
          acompanhantes: item.acompanhantes ?? 0,
          presenca: presenca || "",
          mensagem: item.mensagem || "",
        };
      });
    } catch (e) {
      return [];
    }
  }

  const sheets = await getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `${TAB()}!A2:E`,
  });

  const rows = res.data.values || [];
  return rows.map(([data, nome, acompanhantes, presencaVal, mensagem]) => {
    let presenca = presencaVal;
    if (presenca === "Sim") {
      presenca = "Cerimônia e Almoço";
    } else if (presenca === "Não") {
      presenca = "Não poderei comparecer";
    }
    return ({
      data,
      nome,
      acompanhantes: acompanhantes || "0",
      presenca: presenca || "",
      mensagem: mensagem || "",
    });
  });
}

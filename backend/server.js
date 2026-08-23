import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { uploadPhotoToDrive } from "./src/driveUpload.js";
import { addConfirmation, listConfirmations } from "./src/sheetsDb.js";
import { buildGuestListPdf } from "./src/pdfExport.js";
import { isMockMode } from "./src/googleAuth.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB por foto
});

app.use(cors());
app.use(express.json());

// Serve local mock uploads
const mockUploadsDir = path.resolve("./data/uploads");
if (!fs.existsSync(mockUploadsDir)) {
  fs.mkdirSync(mockUploadsDir, { recursive: true });
}
app.use("/api/uploads", express.static(mockUploadsDir));

// Protege as rotas de admin (listar confirmações e exportar PDF) com
// uma senha simples, configurada em ADMIN_PASSWORD no .env.
function requireAdmin(req, res, next) {
  const senha = req.header("X-Admin-Password");
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  if (senha !== adminPassword) {
    return res.status(401).json({ error: "Senha incorreta." });
  }
  next();
}

app.post("/api/rsvp", async (req, res) => {
  try {
    console.log("Recebendo rsvp:", req.body);
    const { nome, acompanhantes, presenca, vaiAoAlmoco, mensagem } = req.body;

    if (!nome || typeof nome !== "string") {
      return res.status(400).json({ error: "Informe o nome do convidado." });
    }

    let resolvedPresenca = presenca;
    if (!resolvedPresenca && typeof vaiAoAlmoco !== "undefined") {
      resolvedPresenca = vaiAoAlmoco ? "Cerimônia e Almoço" : "Não poderei comparecer";
    }

    const saved = await addConfirmation({
      nome: nome.trim(),
      acompanhantes: acompanhantes ?? 0,
      presenca: resolvedPresenca || "Cerimônia e Almoço",
      mensagem: (mensagem || "").trim(),
    });

    res.status(201).json({ ok: true, confirmacao: saved });
  } catch (err) {
    console.error("Erro ao salvar confirmação:", err);
    res.status(500).json({ error: "Não foi possível salvar a confirmação." });
  }
});

// Só a família (admin) vê a lista completa.
app.get("/api/rsvp", requireAdmin, async (_req, res) => {
  try {
    const confirmacoes = await listConfirmations();
    const totalPessoas = confirmacoes
      .filter((c) => c.presenca !== "Não poderei comparecer")
      .reduce(
        (soma, c) => {
          const acompCount = parseInt(c.acompanhantes, 10) || 0;
          return soma + 1 + acompCount;
        },
        0
      );
    res.json({ confirmacoes, totalPessoas });
  } catch (err) {
    console.error("Erro ao listar confirmações:", err);
    res.status(500).json({ error: "Não foi possível carregar as confirmações." });
  }
});

app.get("/api/rsvp/export-pdf", requireAdmin, async (req, res) => {
  try {
    const { filtro, titulo } = req.query;
    const confirmacoes = await listConfirmations();
    const pdfBuffer = await buildGuestListPdf(confirmacoes, filtro, titulo);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=lista-confirmados-batizado-analu.pdf"
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
    res.status(500).json({ error: "Não foi possível gerar o PDF." });
  }
});

import { handleChunkUpload, handleChunkComplete } from "./src/chunkUpload.js";

// --- Upload de fotos para o Google Drive ---
// Aberto pra qualquer convidado com o link do site (sem senha)
app.post("/api/upload", upload.array("fotos", 10), async (req, res) => {
  try {
    const { nome } = req.body;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ error: "Nenhuma foto enviada." });
    }

    const resultados = [];
    for (const file of files) {
      const result = await uploadPhotoToDrive(file, nome);
      resultados.push(result);
    }

    res.status(201).json({ ok: true, arquivos: resultados });
  } catch (err) {
    console.error("Erro ao enviar fotos:", err);
    res.status(500).json({ error: "Não foi possível enviar as fotos." });
  }
});

// Upload via Chunks (Para arquivos muito grandes como MP4)
app.post("/api/upload-chunk", upload.single("chunk"), handleChunkUpload);
app.post("/api/upload-complete", handleChunkComplete);

// --- Galeria de Fotos ---
// Rota pública para listar todas as fotos enviadas
app.get("/api/gallery", (_req, res) => {
  try {
    const galleryDbPath = path.resolve("./data/gallery.json");
    if (fs.existsSync(galleryDbPath)) {
      const photos = JSON.parse(fs.readFileSync(galleryDbPath, "utf8"));
      // Opcional: ordenar da mais recente para mais antiga
      photos.sort((a, b) => b.timestamp - a.timestamp);
      res.json(photos);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error("Erro ao ler galeria:", err);
    res.status(500).json({ error: "Não foi possível carregar a galeria." });
  }
});

// --- Contas Google Drive (Admin) ---
app.get("/api/admin/drive-accounts", requireAdmin, (_req, res) => {
  try {
    const configPath = path.resolve("./data/drive_config.json");
    if (fs.existsSync(configPath)) {
      res.json(JSON.parse(fs.readFileSync(configPath, "utf8")));
    } else {
      res.json([]);
    }
  } catch (err) {
    res.status(500).json({ error: "Erro ao ler as contas do Drive configuradas." });
  }
});

app.post("/api/admin/drive-accounts", requireAdmin, upload.single("keyFile"), (req, res) => {
  try {
    const { folderId, email } = req.body;
    const file = req.file;
    if (!folderId || !email || !file) {
      return res.status(400).json({ error: "Email, FolderID e Arquivo JSON são obrigatórios." });
    }
    
    // Salvar o arquivo
    const keysDir = path.resolve("./data/keys");
    if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true });
    
    const keyFileName = `key-${Date.now()}.json`;
    const keyPath = path.join(keysDir, keyFileName);
    fs.writeFileSync(keyPath, file.buffer);
    
    // Atualizar config
    const configPath = path.resolve("./data/drive_config.json");
    let configs = [];
    if (fs.existsSync(configPath)) {
      try { configs = JSON.parse(fs.readFileSync(configPath, "utf8")); } catch(e) {}
    }
    
    configs.push({
      id: email,
      keyPath: `./data/keys/${keyFileName}`,
      folderId: folderId
    });
    
    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
    res.json({ ok: true, configs });
  } catch (err) {
    console.error("Erro ao adicionar conta", err);
    res.status(500).json({ error: "Falha ao adicionar nova conta." });
  }
});

app.delete("/api/admin/drive-accounts/:id", requireAdmin, (req, res) => {
  try {
    const configPath = path.resolve("./data/drive_config.json");
    let configs = [];
    if (fs.existsSync(configPath)) {
      try { configs = JSON.parse(fs.readFileSync(configPath, "utf8")); } catch(e) {}
    }
    
    const toRemove = configs.find(c => c.id === req.params.id);
    if (toRemove && toRemove.keyPath) {
      try { fs.unlinkSync(path.resolve(toRemove.keyPath)); } catch(e) {}
    }
    
    configs = configs.filter(c => c.id !== req.params.id);
    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
    res.json({ ok: true, configs });
  } catch (err) {
    res.status(500).json({ error: "Falha ao remover conta." });
  }
});

app.delete("/api/gallery/:id", requireAdmin, (req, res) => {
  try {
    const galleryDbPath = path.resolve("./data/gallery.json");
    if (fs.existsSync(galleryDbPath)) {
      let photos = JSON.parse(fs.readFileSync(galleryDbPath, "utf8"));
      photos = photos.filter((p) => p.id !== req.params.id);
      fs.writeFileSync(galleryDbPath, JSON.stringify(photos, null, 2));
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao deletar foto:", err);
    res.status(500).json({ error: "Falha ao deletar a foto." });
  }
});

// A exclusão de RSVP no Sheets é complexa, então para o modo JSON vamos apenas remover do arquivo local
app.delete("/api/rsvp/:timestamp", requireAdmin, (req, res) => {
  try {
    const mockDbPath = path.resolve("./data/confirmations.json");
    if (fs.existsSync(mockDbPath)) {
      let rsvps = JSON.parse(fs.readFileSync(mockDbPath, "utf8"));
      rsvps = rsvps.filter((r) => r.data !== req.params.timestamp);
      fs.writeFileSync(mockDbPath, JSON.stringify(rsvps, null, 2));
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao deletar rsvp:", err);
    res.status(500).json({ error: "Falha ao deletar RSVP." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor do batizado da Analu rodando em http://localhost:${PORT}`);
  if (isMockMode()) {
    console.log(`\n[AVISO] RODANDO EM MODO MOCK/SIMULAÇÃO LOCAL!`);
    console.log(`- Sem service-account.json ou sem SHEET_ID/DRIVE_FOLDER_ID no .env.`);
    console.log(`- RSVP sendo salvo localmente em: backend/data/confirmations.json`);
    console.log(`- Fotos sendo salvas localmente em: backend/data/uploads/`);
    console.log(`- Senha de acesso admin padrão: admin123\n`);
  } else {
    console.log(`\n[OK] Conectado às APIs do Google Drive e Sheets.`);
    console.log(`- Senha do admin carregada do .env\n`);
  }
});

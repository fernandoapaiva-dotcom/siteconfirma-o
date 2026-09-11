import { useRef, useState } from "react";
import { backgroundKeepAlive } from "../utils/backgroundKeepAlive.js";

export default function PhotoUpload({ onSuccess, onBackgroundUpload }) {
  const [nome, setNome] = useState("");
  const [arquivos, setArquivos] = useState([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function addFiles(fileList) {
    const novos = Array.from(fileList).filter((f) => {
      const type = (f.type || "").toLowerCase();
      const name = (f.name || "").toLowerCase();
      return (
        type.startsWith("image/") ||
        type.startsWith("video/") ||
        /\.(jpg|jpeg|png|gif|webp|heic|heif|mov|mp4|m4v|3gp|webm)$/i.test(name)
      );
    });
    setArquivos((prev) => [...prev, ...novos]);
  }

  function removeFile(indexToRemove) {
    setArquivos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (arquivos.length === 0) return;

    // Dispara a autorização de áudio e segundo plano diretamente pelo toque do usuário
    try {
      backgroundKeepAlive.start();
    } catch (err) {
      console.warn("Erro ao iniciar keepalive:", err);
    }

    if (onBackgroundUpload) {
      onBackgroundUpload(arquivos, nome.trim() || "Convidado");
    }
  }

  return (
    <section className="section">
      <h2 className="section-title">Compartilhe suas fotos</h2>
      <p className="section-subtitle">
        Não teremos fotógrafo profissional — envie aqui os cliques e vídeos que você fizer no dia!
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="nome-foto">Seu nome</label>
        <input
          id="nome-foto"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Quem está enviando?"
        />

        <label>Fotos e vídeos (selecione quantos quiser)</label>
        <div
          className={`upload-drop ${dragging ? "dragging" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          style={{ cursor: "pointer" }}
        >
          <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>📷 🎬</div>
          <div>Toque para escolher ou arraste fotos e vídeos aqui</div>
          <div style={{ fontSize: "0.78rem", color: "#777", marginTop: "4px" }}>
            Pode selecionar vários de uma vez só!
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {arquivos.length > 0 && (
          <div style={{ marginTop: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--ink)" }}>
                {arquivos.length} {arquivos.length === 1 ? "mídia selecionada" : "mídias selecionadas"}:
              </span>
              <button
                type="button"
                onClick={() => setArquivos([])}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#991b1b",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Limpar tudo
              </button>
            </div>
            <ul className="file-list" style={{ maxHeight: "160px", overflowY: "auto", margin: 0 }}>
              {arquivos.map((f, i) => (
                <li key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "85%" }}>
                    {f.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#999",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      padding: "2px 6px",
                    }}
                    title="Remover"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={arquivos.length === 0}
          style={{ marginTop: "16px", width: "100%" }}
        >
          {arquivos.length === 0
            ? "Selecione as fotos para enviar"
            : `Enviar ${arquivos.length} ${arquivos.length === 1 ? "mídia" : "mídias de uma vez"}`}
        </button>

        <p style={{ fontSize: "0.76rem", color: "#4b5563", textAlign: "center", marginTop: "10px", lineHeight: 1.45, fontWeight: "500" }}>
          🛡️ <strong>Segundo plano inteligente ativado:</strong> você pode navegar em outros apps (Instagram, WhatsApp) ou bloquear o celular enquanto suas fotos e vídeos são enviados!
        </p>
      </form>
    </section>
  );
}

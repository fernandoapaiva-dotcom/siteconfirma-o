import { useRef, useState } from "react";

export default function PhotoUpload({ onSuccess, onBackgroundUpload }) {
  const [nome, setNome] = useState("");
  const [arquivos, setArquivos] = useState([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function addFiles(fileList) {
    const novos = Array.from(fileList).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    setArquivos((prev) => [...prev, ...novos]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (arquivos.length === 0) return;

    if (onBackgroundUpload) {
      onBackgroundUpload(arquivos, nome || "convidado");
    }
  }

  return (
    <section className="section">
      <h2 className="section-title">Compartilhe suas fotos</h2>
      <p className="section-subtitle">
        Não teremos fotógrafo profissional — envie aqui os cliques que você fizer no dia!
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

        <label>Fotos e vídeos</label>
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
        >
          Toque para escolher ou arraste as fotos aqui
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
          <ul className="file-list">
            {arquivos.map((f, i) => (
              <li key={i}>{f.name}</li>
            ))}
          </ul>
        )}

        <button type="submit" className="btn-primary" disabled={arquivos.length === 0}>
          Enviar fotos
        </button>
      </form>
    </section>
  );
}

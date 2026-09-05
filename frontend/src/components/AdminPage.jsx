import { useEffect, useState, Fragment } from "react";

const DRIVE_FOLDER_URL = import.meta.env.VITE_DRIVE_FOLDER_URL || "";

function parseCompanions(acompanhantesStr) {
  if (!acompanhantesStr) return [];
  const match = String(acompanhantesStr).match(/\(([^)]+)\)/);
  if (match && match[1]) {
    return match[1].split(",").map(name => name.trim()).filter(Boolean);
  }
  const count = parseInt(acompanhantesStr, 10) || 0;
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push(`Acompanhante ${i + 1}`);
  }
  return list;
}

function DriveAccountsManager({ senha }) {
  const [contas, setContas] = useState([]);
  const [email, setEmail] = useState("");
  const [folderId, setFolderId] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregarContas();
  }, []);

  async function carregarContas() {
    try {
      const res = await fetch("/api/admin/drive-accounts", { headers: { "X-Admin-Password": senha } });
      if (res.ok) {
        setContas(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!email || !folderId || !file) return setStatus("Preencha todos os campos.");
    setLoading(true);
    setStatus("");
    
    const formData = new FormData();
    formData.append("email", email);
    formData.append("folderId", folderId);
    formData.append("keyFile", file);

    try {
      const res = await fetch("/api/admin/drive-accounts", {
        method: "POST",
        headers: { "X-Admin-Password": senha },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setContas(data.configs);
        setEmail(""); setFolderId(""); setFile(null);
        setStatus("Conta adicionada com sucesso!");
      } else {
        setStatus(data.error || "Erro ao adicionar.");
      }
    } catch (err) {
      setStatus("Erro de conexão.");
    }
    setLoading(false);
  }

  async function handleRemove(id) {
    if (!window.confirm(`Remover a conta ${id}?`)) return;
    try {
      const res = await fetch(`/api/admin/drive-accounts/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "X-Admin-Password": senha }
      });
      if (res.ok) {
        setContas((await res.json()).configs);
      }
    } catch (e) {}
  }

  return (
    <section className="section" style={{ marginTop: "32px", borderTop: "1px dashed var(--line)", paddingTop: "32px" }}>
      <h2 className="section-title">Armazenamento: Contas do Google Drive</h2>
      <p className="section-subtitle">O sistema usará essas contas em formato de rodízio (Round-Robin) para fotos.</p>

      <div style={{ background: "white", padding: "20px", borderRadius: "12px", border: "1px solid var(--line)", marginBottom: "20px" }}>
        <h4 style={{ margin: "0 0 16px 0", color: "var(--ink)", fontFamily: "var(--font-display)" }}>Adicionar Nova Conta (JSON)</h4>
        <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input type="email" placeholder="E-mail da conta (ex: batizadoanalu1@gmail.com)" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="text" placeholder="ID da Pasta do Drive (ex: 1A2b3C...)" value={folderId} onChange={e => setFolderId(e.target.value)} required />
          <div style={{ fontSize: "0.9rem" }}>
            <label>Arquivo Chave JSON (Service Account): </label>
            <input type="file" accept=".json" onChange={e => setFile(e.target.files[0])} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ alignSelf: "flex-start", marginTop: "8px" }}>
            {loading ? "Salvando..." : "Adicionar Conta"}
          </button>
          {status && <p style={{ color: status.includes("sucesso") ? "green" : "red", fontSize: "0.9rem", margin: 0 }}>{status}</p>}
        </form>
      </div>

      <div>
        <h4 style={{ margin: "0 0 12px 0", color: "var(--ink)", fontFamily: "var(--font-display)" }}>Contas Configuradas:</h4>
        {contas.length === 0 ? <p style={{ fontSize: "0.9rem", color: "gray" }}>Nenhuma conta extra configurada (usando padrão do .env).</p> : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
            {contas.map(c => (
              <li key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <div>
                  <strong>{c.id}</strong><br/>
                  <span style={{ fontSize: "0.8rem", color: "gray" }}>Pasta: {c.folderId}</span>
                </div>
                <button onClick={() => handleRemove(c.id)} style={{ background: "red", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer" }}>Remover</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default function AdminPage() {
  const [senha, setSenha] = useState(sessionStorage.getItem("admin_pw") || "");
  const [autenticado, setAutenticado] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState("Todos");

  async function carregar(pw) {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/api/rsvp", {
        headers: { "X-Admin-Password": pw },
      });
      if (res.status === 401) {
        setErro("Senha incorreta.");
        setAutenticado(false);
        sessionStorage.removeItem("admin_pw");
        return;
      }
      if (!res.ok) throw new Error("Falha ao carregar");
      const json = await res.json();
      setDados(json);
      setAutenticado(true);
      sessionStorage.setItem("admin_pw", pw);
    } catch (e) {
      setErro("Não foi possível carregar os dados agora.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (senha) carregar(senha);
  }, []); // tenta entrar direto se já tinha senha salva na sessão

  async function baixarPdf() {
    const res = await fetch(`/api/rsvp/export-pdf?filtro=${encodeURIComponent(filtro)}`, {
      headers: { "X-Admin-Password": senha },
    });
    if (!res.ok) {
      setErro("Não foi possível gerar o PDF.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lista-confirmados-${filtro.toLowerCase().replace(/\s+/g, "-")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function baixarListaRestaurante() {
    const res = await fetch(`/api/rsvp/export-pdf?filtro=${encodeURIComponent("Vão ao Almoço")}&titulo=${encodeURIComponent("Lista para o Restaurante (Reserva Versá)")}`, {
      headers: { "X-Admin-Password": senha },
    });
    if (!res.ok) {
      setErro("Não foi possível gerar a lista do restaurante.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lista-restaurante-batizado-analu.pdf";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteRsvp(timestamp) {
    if (!window.confirm("Deseja realmente excluir este convidado da lista?")) return;
    try {
      const res = await fetch(`/api/rsvp/${timestamp}`, {
        method: "DELETE",
        headers: { "X-Admin-Password": senha },
      });
      if (res.ok) {
        carregar(senha);
      } else {
        alert("Erro ao excluir.");
      }
    } catch (err) {
      alert("Erro na requisição.");
    }
  }

  if (!autenticado) {
    return (
      <div className="page">
        <section className="section">
          <h2 className="section-title">Área da família</h2>
          <p className="section-subtitle">Digite a senha de administração.</p>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
          />
          <button
            className="btn-primary"
            disabled={!senha || carregando}
            onClick={() => carregar(senha)}
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
          {erro && <p className="status-msg status-err">{erro}</p>}
        </section>
      </div>
    );
  }

  const confirmacoesFiltradas = (dados?.confirmacoes || []).filter((c) => {
    if (filtro === "Todos") return true;
    if (filtro === "Vão ao Almoço") {
      return c.presenca === "Cerimônia e Almoço" || c.presenca === "Apenas ao Almoço";
    }
    if (filtro === "Vão à Cerimônia") {
      return c.presenca === "Cerimônia e Almoço" || c.presenca === "Apenas à Cerimônia";
    }
    return c.presenca === filtro;
  });

  const totalFiltrado = confirmacoesFiltradas.reduce((soma, c) => {
    const acompCount = parseInt(c.acompanhantes, 10) || 0;
    return soma + 1 + acompCount;
  }, 0);

  let sequentialNumber = 1;

  return (
    <div className="page">
      <section className="section">
        <h2 className="section-title">Confirmações — Batizado da Analu</h2>
        <p className="section-subtitle">
          {totalFiltrado} pessoa(s) nesta visualização (contando acompanhantes).
        </p>

        <div className="admin-actions" style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label htmlFor="filtro-presenca" style={{ margin: 0, fontWeight: "600", fontSize: "0.85rem" }}>Filtrar:</label>
            <select
              id="filtro-presenca"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "white", color: "var(--ink)", fontFamily: "var(--font-body)" }}
            >
              <option value="Todos">Mostrar Todos</option>
              <option value="Vão ao Almoço">Confirmados no Almoço (Cerimônia e Almoço + Apenas Almoço)</option>
              <option value="Vão à Cerimônia">Confirmados na Cerimônia (Cerimônia e Almoço + Apenas Cerimônia)</option>
              <option value="Cerimônia e Almoço">Cerimônia e Almoço</option>
              <option value="Apenas à Cerimônia">Apenas Cerimônia</option>
              <option value="Apenas ao Almoço">Apenas Almoço</option>
              <option value="Não poderei comparecer">Não poderei ir</option>
            </select>
          </div>

          <button className="btn-primary" onClick={baixarPdf} style={{ margin: 0 }}>
            Exportar lista em PDF
          </button>
          <button className="btn-primary" onClick={baixarListaRestaurante} style={{ margin: 0, backgroundColor: "#5f6e52" }}>
            Lista Restaurante
          </button>
          {DRIVE_FOLDER_URL && (
            <a className="btn-primary btn-secondary" href={DRIVE_FOLDER_URL} target="_blank" rel="noreferrer" style={{ margin: 0 }}>
              Pasta de fotos
            </a>
          )}
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Acompanhantes</th>
              <th>Presença</th>
              <th>Mensagem</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {confirmacoesFiltradas.map((c, i) => {
              const acompList = parseCompanions(c.acompanhantes);
              const mainGuestNumber = sequentialNumber++;
              const countOnly = parseInt(c.acompanhantes, 10) || 0;

              return (
                <Fragment key={i}>
                  <tr>
                    <td style={{ fontWeight: "600" }}>{mainGuestNumber} - {c.nome}</td>
                    <td>{countOnly > 0 ? countOnly : "0"}</td>
                    <td>{c.presenca}</td>
                    <td>{c.mensagem}</td>
                    <td>
                      <button onClick={() => handleDeleteRsvp(c.data)} style={{ background: "red", color: "white", padding: "4px 8px", borderRadius: "4px", border: "none", cursor: "pointer", fontSize: "0.75rem" }}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                  {acompList.map((compName, idx) => {
                    const compNumber = sequentialNumber++;
                    return (
                      <tr key={`comp-${i}-${idx}`} style={{ backgroundColor: "rgba(95, 110, 82, 0.03)" }}>
                        <td style={{ paddingLeft: "30px", fontStyle: "italic", color: "var(--sage-deep)" }}>
                          &nbsp;&nbsp;&nbsp;&nbsp;{compNumber} - {compName}
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Seção de Contas do Drive */}
      <DriveAccountsManager senha={senha} />

      {/* Gerenciador de Galeria */}
      <GalleryManager senha={senha} />
    </div>
  );
}

function GalleryManager({ senha }) {
  const [photos, setPhotos] = useState([]);

  async function loadPhotos() {
    try {
      const res = await fetch("/api/gallery?admin=true", { headers: { "X-Admin-Password": senha } });
      if (res.ok) {
        setPhotos(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    loadPhotos();
  }, []);

  async function toggleVisibility(id, currentHidden) {
    try {
      const res = await fetch(`/api/gallery/${id}/visibility`, {
        method: "PATCH",
        headers: { "X-Admin-Password": senha, "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: !currentHidden })
      });
      if (res.ok) {
        loadPhotos();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function deletePhoto(id) {
    if (!window.confirm("Excluir esta foto da galeria do site? (Ela continuará salva no Google Drive)")) return;
    try {
      const res = await fetch(`/api/gallery/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-Password": senha },
      });
      if (res.ok) {
        loadPhotos();
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <section className="section" style={{ marginTop: "40px" }}>
      <h2 className="section-title">Gerenciar Galeria de Fotos</h2>
      <p className="section-subtitle">Exclua fotos indesejadas do site.</p>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "12px", marginTop: "20px" }}>
        {photos.map(p => (
          <div key={p.id} style={{ position: "relative", border: "1px solid var(--line)", borderRadius: "8px", padding: "8px", textAlign: "center", opacity: p.hidden ? 0.5 : 1 }}>
            {p.mimeType?.startsWith("video") ? (
              <video src={p.fileUrl} style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "4px" }} muted />
            ) : (
              <img src={p.thumbnailUrl || p.fileUrl} style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "4px" }} alt="" />
            )}
            <p style={{ fontSize: "0.75rem", margin: "4px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.uploaderName}</p>
            <button onClick={() => deletePhoto(p.id)} style={{ width: "100%", padding: "4px", background: "red", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>
              Excluir
            </button>
          </div>
        ))}
        {photos.length === 0 && <p>Nenhuma foto enviada ainda.</p>}
      </div>
    </section>
  );
}





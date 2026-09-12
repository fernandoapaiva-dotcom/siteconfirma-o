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
  const [busca, setBusca] = useState("");
  const [expandedMsgs, setExpandedMsgs] = useState(() => new Set());

  function toggleMsgExpanded(key) {
    setExpandedMsgs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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

  const buscaNormalizada = busca.trim().toLowerCase();

  const confirmacoesFiltradas = (dados?.confirmacoes || []).filter((c) => {
    if (filtro === "Todos") {
      // segue adiante
    } else if (filtro === "Vão ao Almoço") {
      if (!(c.presenca === "Cerimônia e Almoço" || c.presenca === "Apenas ao Almoço")) return false;
    } else if (filtro === "Vão à Cerimônia") {
      if (!(c.presenca === "Cerimônia e Almoço" || c.presenca === "Apenas à Cerimônia")) return false;
    } else if (c.presenca !== filtro) {
      return false;
    }

    if (buscaNormalizada) {
      const nomeMatch = (c.nome || "").toLowerCase().includes(buscaNormalizada);
      const acompMatch = (c.acompanhantes || "").toLowerCase().includes(buscaNormalizada);
      if (!nomeMatch && !acompMatch) return false;
    }

    return true;
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

          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome..."
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "white", color: "var(--ink)", fontFamily: "var(--font-body)", minWidth: "180px" }}
          />

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

        <div style={{ maxHeight: "62vh", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "10px" }}>
          <table className="admin-table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", top: 0, background: "var(--paper, #fdf8ee)", zIndex: 1 }}>Nome</th>
                <th style={{ position: "sticky", top: 0, background: "var(--paper, #fdf8ee)", zIndex: 1 }}>Acompanhantes</th>
                <th style={{ position: "sticky", top: 0, background: "var(--paper, #fdf8ee)", zIndex: 1 }}>Presença</th>
                <th style={{ position: "sticky", top: 0, background: "var(--paper, #fdf8ee)", zIndex: 1 }}>Mensagem</th>
                <th style={{ position: "sticky", top: 0, background: "var(--paper, #fdf8ee)", zIndex: 1 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {confirmacoesFiltradas.map((c, i) => {
                const acompList = parseCompanions(c.acompanhantes);
                const mainGuestNumber = sequentialNumber++;
                const countOnly = parseInt(c.acompanhantes, 10) || 0;
                const msgKey = c.data || i;
                const msg = c.mensagem || "";
                const isLongMsg = msg.length > 60;
                const isExpanded = expandedMsgs.has(msgKey);

                return (
                  <Fragment key={i}>
                    <tr>
                      <td style={{ fontWeight: "600" }}>{mainGuestNumber} - {c.nome}</td>
                      <td>{countOnly > 0 ? countOnly : "0"}</td>
                      <td>{c.presenca}</td>
                      <td style={{ maxWidth: "260px" }}>
                        {isLongMsg && !isExpanded ? (
                          <>
                            {msg.slice(0, 60)}…{" "}
                            <button
                              onClick={() => toggleMsgExpanded(msgKey)}
                              style={{ background: "none", border: "none", color: "var(--gold-deep)", cursor: "pointer", fontSize: "0.75rem", padding: 0, textDecoration: "underline" }}
                            >
                              ver mais
                            </button>
                          </>
                        ) : (
                          <>
                            {msg}
                            {isLongMsg && (
                              <>
                                {" "}
                                <button
                                  onClick={() => toggleMsgExpanded(msgKey)}
                                  style={{ background: "none", border: "none", color: "var(--gold-deep)", cursor: "pointer", fontSize: "0.75rem", padding: 0, textDecoration: "underline" }}
                                >
                                  ver menos
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </td>
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
              {confirmacoesFiltradas.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "gray", padding: "20px" }}>
                    Nenhuma confirmação encontrada para esse filtro/busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [collapsedAuthors, setCollapsedAuthors] = useState(() => new Set());

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

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAuthorGroup(authorPhotos) {
    const ids = authorPhotos.map((p) => p.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function toggleCollapsed(author) {
    setCollapsedAuthors((prev) => {
      const next = new Set(prev);
      if (next.has(author)) next.delete(author);
      else next.add(author);
      return next;
    });
  }

  async function deleteIds(ids, confirmMsg) {
    if (ids.length === 0) return;
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/gallery", {
        method: "DELETE",
        headers: { "X-Admin-Password": senha, "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        setSelected((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        await loadPhotos();
      } else {
        alert("Erro ao excluir.");
      }
    } catch (e) {
      alert("Erro na requisição.");
    } finally {
      setBusy(false);
    }
  }

  const groups = {};
  for (const p of photos) {
    const key = p.uploaderName || "Convidado";
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  const authors = Object.keys(groups).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <section className="section" style={{ marginTop: "40px" }}>
      <h2 className="section-title">Gerenciar Galeria de Fotos</h2>
      <p className="section-subtitle">
        Agrupado por quem enviou. Marque fotos individuais ou selecione todas de um autor para excluir de uma vez.
      </p>

      {photos.length === 0 ? (
        <p>Nenhuma foto enviada ainda.</p>
      ) : (
        <>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              background: "var(--paper, #fdf8ee)",
              border: "1px solid var(--line)",
              borderRadius: "10px",
              padding: "10px 14px",
              margin: "16px 0",
            }}
          >
            <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--ink)" }}>
              {selected.size > 0
                ? `${selected.size} mídia${selected.size > 1 ? "s" : ""} selecionada${selected.size > 1 ? "s" : ""}`
                : `${photos.length} mídia(s) no total, de ${authors.length} autor(es)`}
            </span>
            {selected.size > 0 && (
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setSelected(new Set())}
                  disabled={busy}
                  style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--ink)", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  Limpar seleção
                </button>
                <button
                  onClick={() =>
                    deleteIds(
                      Array.from(selected),
                      `Excluir ${selected.size} mídia(s) selecionada(s) da galeria do site? (Continuam salvas no Google Drive)`
                    )
                  }
                  disabled={busy}
                  style={{ background: "red", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "600" }}
                >
                  {busy ? "Excluindo..." : `Excluir selecionadas (${selected.size})`}
                </button>
              </div>
            )}
          </div>

          {authors.map((author) => {
            const authorPhotos = groups[author];
            const ids = authorPhotos.map((p) => p.id);
            const allSelected = ids.every((id) => selected.has(id));
            const someSelected = ids.some((id) => selected.has(id));
            const isCollapsed = collapsedAuthors.has(author);

            return (
              <div key={author} style={{ border: "1px solid var(--line)", borderRadius: "10px", marginBottom: "16px", overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    background: "rgba(184, 147, 63, 0.08)",
                    borderBottom: isCollapsed ? "none" : "1px solid var(--line)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={() => toggleAuthorGroup(authorPhotos)}
                    title="Selecionar todas deste autor"
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <button
                    onClick={() => toggleCollapsed(author)}
                    style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", flex: 1, textAlign: "left", padding: 0 }}
                  >
                    <strong style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>{author}</strong>
                    <span style={{ fontSize: "0.78rem", color: "var(--sage-deep)" }}>
                      ({authorPhotos.length} {authorPhotos.length === 1 ? "mídia" : "mídias"}) {isCollapsed ? "▸" : "▾"}
                    </span>
                  </button>
                  <button
                    onClick={() => deleteIds(ids, `Excluir todas as ${ids.length} mídias de ${author}? (Continuam salvas no Google Drive)`)}
                    disabled={busy}
                    style={{ background: "red", color: "white", border: "none", padding: "5px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem" }}
                  >
                    Excluir todas
                  </button>
                </div>

                {!isCollapsed && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "12px", padding: "14px" }}>
                    {authorPhotos.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          position: "relative",
                          border: selected.has(p.id) ? "2px solid var(--gold-deep)" : "1px solid var(--line)",
                          borderRadius: "8px",
                          padding: "8px",
                          textAlign: "center",
                          opacity: p.hidden ? 0.5 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleSelected(p.id)}
                          style={{ position: "absolute", top: "10px", left: "10px", width: "18px", height: "18px", cursor: "pointer", zIndex: 1 }}
                        />
                        {p.mimeType?.startsWith("video") ? (
                          <video src={p.fileUrl} style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "4px" }} muted />
                        ) : (
                          <img src={p.thumbnailUrl || p.fileUrl} style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "4px" }} alt="" />
                        )}
                        <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
                          <button
                            onClick={() => toggleVisibility(p.id, p.hidden)}
                            title={p.hidden ? "Reexibir no site" : "Ocultar do site"}
                            style={{ flex: 1, padding: "4px", background: "var(--sage-deep)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.7rem" }}
                          >
                            {p.hidden ? "Mostrar" : "Ocultar"}
                          </button>
                          <button
                            onClick={() => deleteIds([p.id], "Excluir esta foto da galeria do site? (Ela continuará salva no Google Drive)")}
                            disabled={busy}
                            style={{ flex: 1, padding: "4px", background: "red", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.7rem" }}
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}





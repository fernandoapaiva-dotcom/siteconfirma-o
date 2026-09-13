import { useEffect, useState, useRef, Fragment } from "react";
import ReactDOM from "react-dom";
import ZoomableImage from "./ZoomableImage.jsx";

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
    <section className="section">
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
  const [adminTab, setAdminTab] = useState("confirmacoes"); // confirmacoes | contas | galeria

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
      <div className="admin-tabs">
        <button
          className={`admin-tab ${adminTab === "confirmacoes" ? "active" : ""}`}
          onClick={() => setAdminTab("confirmacoes")}
        >
          📋 Confirmações
        </button>
        <button
          className={`admin-tab ${adminTab === "contas" ? "active" : ""}`}
          onClick={() => setAdminTab("contas")}
        >
          ⚙️ Contas / E-mail
        </button>
        <button
          className={`admin-tab ${adminTab === "galeria" ? "active" : ""}`}
          onClick={() => setAdminTab("galeria")}
        >
          🖼️ Galeria de Fotos
        </button>
      </div>

      {adminTab === "confirmacoes" && (
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
      )}

      {adminTab === "contas" && <DriveAccountsManager senha={senha} />}

      {adminTab === "galeria" && <GalleryManager senha={senha} />}
    </div>
  );
}

/**
 * Lista arrastável (mouse ou toque, via Pointer Events) com a ordem em que os
 * Melhores Momentos aparecem no site. Reordena localmente enquanto arrasta
 * pra dar retorno visual instantâneo, e só grava no servidor quando solta.
 */
function FeaturedManager({ senha, photos, onReordered }) {
  const featuredItems = photos
    .filter((p) => p.featured)
    .sort((a, b) => {
      const oa = a.featuredOrder ?? Infinity;
      const ob = b.featuredOrder ?? Infinity;
      if (oa !== ob) return oa - ob;
      return b.timestamp - a.timestamp;
    });
  const featuredKey = featuredItems.map((p) => p.id).join(",");

  const [order, setOrder] = useState(() => featuredItems.map((p) => p.id));
  useEffect(() => {
    setOrder(featuredItems.map((p) => p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuredKey]);

  const containerRef = useRef(null);
  const dragRef = useRef({ id: null, savedOrder: null });
  const [saving, setSaving] = useState(false);

  if (featuredItems.length === 0) return null;

  const itemsById = Object.fromEntries(featuredItems.map((p) => [p.id, p]));

  function handlePointerDown(e, id) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id, savedOrder: order };
  }

  function handlePointerMove(e) {
    const st = dragRef.current;
    if (!st.id || !containerRef.current) return;
    const rows = Array.from(containerRef.current.querySelectorAll("[data-drag-id]"));
    let targetIdx = order.length - 1;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        targetIdx = i;
        break;
      }
    }
    const currentIdx = order.indexOf(st.id);
    if (currentIdx !== -1 && currentIdx !== targetIdx) {
      const next = [...order];
      next.splice(currentIdx, 1);
      next.splice(targetIdx, 0, st.id);
      setOrder(next);
    }
  }

  async function handlePointerUp() {
    const st = dragRef.current;
    if (!st.id) return;
    const changed = st.savedOrder && st.savedOrder.join(",") !== order.join(",");
    dragRef.current = { id: null, savedOrder: null };
    if (!changed) return;
    setSaving(true);
    try {
      await fetch("/api/gallery/reorder", {
        method: "PATCH",
        headers: { "X-Admin-Password": senha, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: order }),
      });
      onReordered();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "rgba(184, 147, 63, 0.08)", border: "1px solid var(--gold)", borderRadius: "10px", padding: "14px", marginBottom: "20px" }}>
      <h4 style={{ margin: "0 0 4px", color: "var(--gold-deep)", fontFamily: "var(--font-display)" }}>
        ★ Ordem dos Melhores Momentos {saving && "(salvando...)"}
      </h4>
      <p style={{ margin: "0 0 12px", fontSize: "0.8rem", color: "var(--sage-deep)" }}>
        Segure a alcinha ⠿ e arraste pra mudar a ordem que aparece no site.
      </p>
      <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {order.map((id) => {
          const p = itemsById[id];
          if (!p) return null;
          return (
            <div
              key={id}
              data-drag-id={id}
              style={{ display: "flex", alignItems: "center", gap: "10px", background: "white", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--line)" }}
            >
              <div
                onPointerDown={(e) => handlePointerDown(e, id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ cursor: "grab", fontSize: "1.2rem", color: "#999", padding: "4px 8px", touchAction: "none" }}
              >
                ⠿
              </div>
              <img src={`https://drive.google.com/thumbnail?id=${p.id}&sz=w100`} style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "6px" }} alt="" />
              <span style={{ flex: 1, fontSize: "0.82rem", color: "var(--ink)" }}>{p.uploaderName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GalleryManager({ senha }) {
  const [photos, setPhotos] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [collapsedAuthors, setCollapsedAuthors] = useState(() => new Set());
  const [moveTarget, setMoveTarget] = useState("");
  const [preview, setPreview] = useState(null); // { author, index }

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

  async function toggleFeatured(id, currentFeatured) {
    try {
      const res = await fetch(`/api/gallery/${id}/featured`, {
        method: "PATCH",
        headers: { "X-Admin-Password": senha, "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !currentFeatured })
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

  async function moveIds(ids, uploaderName) {
    const nome = (uploaderName || "").trim();
    if (ids.length === 0 || !nome) return;
    setBusy(true);
    try {
      const res = await fetch("/api/gallery/move", {
        method: "PATCH",
        headers: { "X-Admin-Password": senha, "Content-Type": "application/json" },
        body: JSON.stringify({ ids, uploaderName: nome }),
      });
      if (res.ok) {
        setSelected((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        setMoveTarget("");
        await loadPhotos();
      } else {
        alert("Erro ao mover.");
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
    <section className="section">
      <h2 className="section-title">Gerenciar Galeria de Fotos</h2>
      <p className="section-subtitle">
        Agrupado por quem enviou. Marque fotos individuais ou selecione todas de um autor para excluir de uma vez.
      </p>

      <FeaturedManager senha={senha} photos={photos} onReordered={loadPhotos} />

      {photos.length === 0 ? (
        <p>Nenhuma foto enviada ainda.</p>
      ) : (
        <>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              background: "var(--paper, #fdf8ee)",
              border: "1px solid var(--line)",
              borderRadius: "10px",
              padding: "10px 14px",
              margin: "16px 0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--ink)" }}>
                {selected.size > 0
                  ? `${selected.size} mídia${selected.size > 1 ? "s" : ""} selecionada${selected.size > 1 ? "s" : ""}`
                  : `${photos.length} mídia(s) no total, de ${authors.length} autor(es)`}
              </span>
              {selected.size > 0 && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => { setSelected(new Set()); setMoveTarget(""); }}
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

            {selected.size > 0 && (
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--line)" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--sage-deep)", fontWeight: "600" }}>Mover para o álbum de:</span>
                <input
                  type="text"
                  list="album-names"
                  value={moveTarget}
                  onChange={(e) => setMoveTarget(e.target.value)}
                  placeholder="Nome da pessoa (ex: Rosana)"
                  style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "0.8rem", flex: "1", minWidth: "160px" }}
                />
                <datalist id="album-names">
                  {authors.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
                <button
                  onClick={() => moveIds(Array.from(selected), moveTarget)}
                  disabled={busy || !moveTarget.trim()}
                  style={{
                    background: moveTarget.trim() ? "var(--gold)" : "var(--line)",
                    color: "white",
                    border: "none",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    cursor: moveTarget.trim() ? "pointer" : "not-allowed",
                    fontSize: "0.8rem",
                    fontWeight: "600",
                  }}
                >
                  {busy ? "Movendo..." : "Mover"}
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
                        <button
                          onClick={() => toggleFeatured(p.id, p.featured)}
                          title={p.featured ? "Remover dos Melhores Momentos" : "Marcar como Melhor Momento"}
                          style={{
                            position: "absolute", top: "8px", right: "8px", zIndex: 1,
                            width: "24px", height: "24px", borderRadius: "50%", cursor: "pointer",
                            border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                            background: p.featured ? "var(--gold)" : "rgba(0,0,0,0.45)",
                            color: "white", fontSize: "0.85rem", lineHeight: 1,
                          }}
                        >
                          {p.featured ? "★" : "☆"}
                        </button>
                        <img
                          src={`https://drive.google.com/thumbnail?id=${p.id}&sz=w200`}
                          onClick={() => setPreview({ author, index: authorPhotos.indexOf(p) })}
                          style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "4px", cursor: "pointer" }}
                          alt=""
                        />
                        {p.mimeType?.startsWith("video") && (
                          <div style={{ position: "absolute", top: "38px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.55)", borderRadius: "50%", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
                          </div>
                        )}
                        {p.featured && (
                          <div style={{ fontSize: "0.65rem", fontWeight: "700", color: "var(--gold-deep)", marginTop: "3px" }}>
                            ★ Melhor Momento
                          </div>
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

      {preview && (
        <AdminPreviewModal
          items={groups[preview.author] || []}
          startIndex={preview.index}
          onClose={() => setPreview(null)}
          onToggleFeatured={toggleFeatured}
          onToggleVisibility={toggleVisibility}
        />
      )}
    </section>
  );
}

/**
 * Pré-visualização em tela cheia com zoom (pinça/duplo-toque), pra dar pra
 * família ver a foto em detalhe antes de decidir se ela entra nos Melhores
 * Momentos. Navega entre as mídias do mesmo autor e deixa marcar/desmarcar
 * destaque e ocultar sem precisar fechar.
 */
function AdminPreviewModal({ items, startIndex, onClose, onToggleFeatured, onToggleVisibility }) {
  const [idx, setIdx] = useState(startIndex || 0);
  const current = items[idx];

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((p) => (p + 1) % items.length);
      if (e.key === "ArrowLeft") setIdx((p) => (p - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [items.length, onClose]);

  if (!current) return null;
  const isVideo = current.mimeType?.startsWith("video");
  const prev = (e) => { e.stopPropagation(); setIdx((p) => (p - 1 + items.length) % items.length); };
  const next = (e) => { e.stopPropagation(); setIdx((p) => (p + 1) % items.length); };

  const overlay = (
    <div
      style={{
        position: "fixed", inset: 0, width: "100dvw", height: "100dvh", background: "#000",
        zIndex: 999999, display: "flex", flexDirection: "column",
      }}
      onClick={onClose}
    >
      <div
        style={{
          flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 16px", background: "linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)",
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span style={{ background: "rgba(255,255,255,0.18)", color: "white", padding: "5px 14px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "700" }}>
          {current.uploaderName} · {idx + 1} / {items.length}
        </span>
        <button
          onClick={onClose}
          style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "white", borderRadius: "50%", width: "38px", height: "38px", fontSize: "20px", cursor: "pointer" }}
        >
          &times;
        </button>
      </div>

      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {isVideo ? (
          <iframe
            key={current.id}
            src={`https://drive.google.com/file/d/${current.id}/preview`}
            allow="autoplay"
            allowFullScreen
            style={{ maxWidth: "100dvw", maxHeight: "calc(100dvh - 110px)", width: "100%", height: "100%", border: "none", background: "#000" }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            key={current.id}
            style={{ width: "100dvw", height: "calc(100dvh - 110px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <ZoomableImage
              src={`https://drive.google.com/thumbnail?id=${current.id}&sz=w1600`}
              alt={"Foto de " + current.uploaderName}
            />
          </div>
        )}
      </div>

      {items.length > 1 && (
        <>
          <button
            onClick={prev}
            style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.45)", border: "none", color: "white", borderRadius: "50%", width: "42px", height: "42px", fontSize: "22px", cursor: "pointer", zIndex: 3 }}
          >
            &lsaquo;
          </button>
          <button
            onClick={next}
            style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.45)", border: "none", color: "white", borderRadius: "50%", width: "42px", height: "42px", fontSize: "22px", cursor: "pointer", zIndex: 3 }}
          >
            &rsaquo;
          </button>
        </>
      )}

      <div
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 20px 24px", display: "flex", justifyContent: "center", gap: "12px", background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)", zIndex: 2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onToggleFeatured(current.id, current.featured)}
          style={{
            background: current.featured ? "var(--gold)" : "rgba(255,255,255,0.18)",
            border: "none", color: "white", borderRadius: "24px", padding: "8px 18px",
            fontSize: "0.85rem", cursor: "pointer", fontWeight: "600",
          }}
        >
          {current.featured ? "★ Nos Melhores Momentos" : "☆ Marcar como Melhor Momento"}
        </button>
        <button
          onClick={() => onToggleVisibility(current.id, current.hidden)}
          style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "white", borderRadius: "24px", padding: "8px 18px", fontSize: "0.85rem", cursor: "pointer" }}
        >
          {current.hidden ? "Mostrar no site" : "Ocultar do site"}
        </button>
      </div>
    </div>
  );

  return ReactDOM.createPortal(overlay, document.body);
}



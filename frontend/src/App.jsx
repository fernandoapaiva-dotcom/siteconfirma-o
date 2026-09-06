import { useState, useEffect } from "react";
import Hero from "./components/Hero.jsx";
import RsvpForm from "./components/RsvpForm.jsx";
import PhotoUpload from "./components/PhotoUpload.jsx";
import LocationMaps from "./components/LocationMaps.jsx";
import FloatingElements from "./components/FloatingElements.jsx";
import Gallery from "./components/Gallery.jsx";

export default function App() {
  const [activeTab, setActiveTab] = useState(null); // null | "rsvp" | "mapas" | "fotos"
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(1); // 1: Welcome, 2: Cards explanation
  const [backgroundUpload, setBackgroundUpload] = useState({ active: false, progress: 0, text: "" });

  useEffect(() => {
    const hasSeen = localStorage.getItem("hasSeenTour_analu");
    if (!hasSeen) {
      setShowTour(true);
    }
  }, []);

  async function handleBackgroundUpload(arquivos, nome) {
    setActiveTab(null); // Fecha a modal imediatamente
    setBackgroundUpload({ active: true, progress: 0, phase: "sending", text: `Iniciando envio de ${arquivos.length} arquivo(s)...` });
    
    try {
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
      const totalBytes = arquivos.reduce((acc, f) => acc + f.size, 0);
      let uploadedBytes = 0;

      for (let i = 0; i < arquivos.length; i++) {
        const file = arquivos[i];
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const uploadId = `upl_${Date.now()}_${i}`;

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunkBlob = file.slice(start, end);

          const formData = new FormData();
          formData.append("uploadId", uploadId);
          formData.append("chunkIndex", chunkIndex);
          formData.append("totalChunks", totalChunks);
          formData.append("chunk", chunkBlob);

          const res = await fetch("/api/upload-chunk", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) throw new Error("Falha no upload do chunk");

          uploadedBytes += chunkBlob.size;
          const percent = Math.round((uploadedBytes / totalBytes) * 100);
          setBackgroundUpload(prev => ({ ...prev, progress: percent, text: `Enviando em segundo plano... voce pode usar outros apps!`, phase: "sending" }));
        }

        // Finaliza o arquivo
        const completeRes = await fetch("/api/upload-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadId,
            fileName: file.name,
            mimeType: file.type,
            nome
          })
        });

        if (!completeRes.ok) throw new Error("Falha ao montar o arquivo no servidor");
      }

      setBackgroundUpload({ active: true, progress: 100, phase: "done", text: "Tudo enviado com sucesso! Obrigado!" });
      setTimeout(() => setBackgroundUpload({ active: false, progress: 0, phase: "", text: "" }), 5000);
    } catch (err) {
      console.error(err);
      setBackgroundUpload({ active: true, progress: 0, phase: "error", text: "Erro ao enviar. Verifique a internet e tente de novo." });
      setTimeout(() => setBackgroundUpload({ active: false, progress: 0, phase: "", text: "" }), 5000);
    }
  }

  const handleFinishTour = () => {
    localStorage.setItem("hasSeenTour_analu", "true");
    setShowTour(false);
  };

  const handleSuccessClose = () => {
    setTimeout(() => {
      setActiveTab(null);
    }, 3000);
  };

  return (
    <>
      <FloatingElements />
      <div className="page">
        <div className="invitation-card">
          <Hero />

          {/* Menu de MÃ³dulos: Proporcional e com breves descriÃ§Ãµes */}
          <div className="modules-grid">
            <button
              className={`module-card ${showTour && tourStep === 2 ? "tour-highlight" : ""}`}
              onClick={() => setActiveTab("rsvp")}
              title="Confirmar PresenÃ§a (RSVP)"
            >
              <svg className="module-icon-large" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="6" width="14" height="14" rx="2" />
                <line x1="16" y1="3" x2="16" y2="7" stroke="var(--gold)" />
                <line x1="8" y1="3" x2="8" y2="7" stroke="var(--gold)" />
                <line x1="5" y1="11" x2="19" y2="11" />
                <path d="M12 14c-1-1.2-2.2-.5-2.2.5 0 1 2.2 2.5 2.2 2.5s2.2-1.5 2.2-2.5c0-1-1.2-1.7-2.2-.5z" fill="var(--gold)" stroke="var(--gold)" strokeWidth="0.5" />
              </svg>
              <h3 className="module-title">PresenÃ§a</h3>
              <p className="module-desc">Confirme sua vinda atÃ© 30/08</p>
            </button>

            <button
              className={`module-card ${showTour && tourStep === 3 ? "tour-highlight" : ""}`}
              onClick={() => setActiveTab("mapas")}
              title="LocalizaÃ§Ã£o e Como Chegar"
            >
              <svg className="module-icon-large" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l7 6v14H5V8l7-6z" />
                <path d="M10 22v-5c0-1.1.9-2 2-2s2 .9 2 2v5" />
                <circle cx="12" cy="11" r="1.5" />
                <path d="M12 2V0M11 1h2" stroke="var(--gold)" strokeWidth="1.5" />
              </svg>
              <h3 className="module-title">LocalizaÃ§Ã£o</h3>
              <p className="module-desc">Como chegar ao batizado</p>
            </button>

            <button
              className={`module-card ${showTour && tourStep === 4 ? "tour-highlight" : ""}`}
              onClick={() => setActiveTab("fotos")}
              title="Enviar Fotos e VÃ­deos"
            >
              <svg className="module-icon-large" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" stroke="var(--gold)" />
                <circle cx="12" cy="13" r="1.5" fill="var(--gold)" stroke="var(--gold)" />
              </svg>
              <h3 className="module-title">Enviar Fotos</h3>
              <p className="module-desc">Compartilhe suas recordaÃ§Ãµes</p>
            </button>
          </div>

          {/* Galeria de Fotos */}
          <Gallery />

          <p className="footer-note">SerÃ¡ uma alegria compartilhar esse momento especial com vocÃª.</p>
          
          <p className="invitation-footer-verse">
            "Deixai vir a mim os pequeninos, pois deles Ã© o Reino dos CÃ©us." <br />
            â€” Mateus 19:14
          </p>
        </div> {/* fim da .invitation-card */}
        
        <div style={{ textAlign: "center", marginTop: "32px", marginBottom: "20px" }}>
          <a
            href="/admin"
            style={{
              padding: "6px 16px",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              textDecoration: "none",
              borderRadius: "20px",
              display: "inline-block",
              border: "1px solid var(--sage)",
              color: "var(--sage-deep)",
              background: "rgba(95, 110, 82, 0.05)",
              fontFamily: "var(--font-body)",
              transition: "all 0.2s ease"
            }}
          >
            Painel Admin
          </a>
        </div>
      </div>

      {/* MODAIS fora do .page â€” o backdrop-filter do invitation-card cria
          um stacking context que prende o position:fixed dentro do pai.
          Movendo para fora, eles cobrem a tela toda corretamente. */}

      {activeTab && (
        <div className="modal-overlay">
          <div className="modal-content-wrapper">
            <button className="btn-back" onClick={() => setActiveTab(null)}>
              â† Voltar para o Convite
            </button>
            <div className="modal-card-body">
              {activeTab === "rsvp" && <RsvpForm onSuccess={handleSuccessClose} />}
              {activeTab === "mapas" && <LocationMaps />}
              {activeTab === "fotos" && <PhotoUpload onBackgroundUpload={handleBackgroundUpload} />}
            </div>
          </div>
        </div>
      )}

      {backgroundUpload.active && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: backgroundUpload.phase === "done" ? "#f0fdf4" : backgroundUpload.phase === "error" ? "#fef2f2" : "white",
          padding: "14px 18px",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
          zIndex: 9999,
          borderTop: backgroundUpload.phase === "done" ? "3px solid #10b981" : backgroundUpload.phase === "error" ? "3px solid #ef4444" : "3px solid var(--gold)",
          transition: "all 0.3s ease"
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", maxWidth: "500px", margin: "0 auto" }}>
            <div style={{ fontSize: "1.6rem", flexShrink: 0, lineHeight: 1 }}>
              {backgroundUpload.phase === "done" ? "\u2705" : backgroundUpload.phase === "error" ? "\u26a0\ufe0f" : "\u{1F4F2}"}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 2px", fontSize: "0.95rem", fontWeight: "700", color: backgroundUpload.phase === "done" ? "#065f46" : backgroundUpload.phase === "error" ? "#991b1b" : "var(--ink)", fontFamily: "var(--font-display)" }}>
                {backgroundUpload.phase === "done" ? "Fotos enviadas com sucesso!" : backgroundUpload.phase === "error" ? "Erro no envio" : "Enviando em segundo plano..."}
              </p>
              {backgroundUpload.phase === "sending" && (
                <p style={{ margin: "0 0 8px", fontSize: "0.78rem", color: "#555", lineHeight: 1.45 }}>
                  Pode guardar o celular, usar outros apps ou sair desta tela. O envio continua automaticamente!
                </p>
              )}
              {backgroundUpload.phase === "done" && (
                <p style={{ margin: "0 0 4px", fontSize: "0.78rem", color: "#065f46" }}>
                  Obrigado por compartilhar seus momentos com a gente!
                </p>
              )}
              {backgroundUpload.phase === "error" && (
                <p style={{ margin: "0 0 8px", fontSize: "0.78rem", color: "#991b1b" }}>
                  Verifique sua internet e tente novamente.
                </p>
              )}
              {backgroundUpload.phase !== "error" && (
                <>
                  <div style={{ background: "rgba(0,0,0,0.08)", borderRadius: "8px", height: "6px", overflow: "hidden" }}>
                    <div style={{ width: `${backgroundUpload.progress}%`, height: "100%", background: backgroundUpload.phase === "done" ? "#10b981" : "var(--gold)", transition: "width 0.4s ease" }}></div>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "#999" }}>
                    {backgroundUpload.progress}% concluido
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showTour && (
        <div className="tour-overlay">
          <div className="tour-card">
            <button className="tour-close-btn" onClick={handleFinishTour} aria-label="Fechar tour">Ã—</button>
            <div className="tour-step-indicator">Passo {tourStep} de 4</div>
            {tourStep === 1 && (
              <>
                <h4 className="tour-title">Seja bem-vindo!</h4>
                <p className="tour-text">Preparamos este espaÃ§o com muito amor para o batizado da Analu. Vamos fazer um tour rÃ¡pido de 15 segundos para te mostrar como interagir com o convite?</p>
                <div className="tour-actions">
                  <button className="btn-tour-skip" onClick={handleFinishTour}>Pular Tour</button>
                  <button className="btn-tour-next" onClick={() => setTourStep(2)}>ComeÃ§ar!</button>
                </div>
              </>
            )}
            {tourStep === 2 && (
              <>
                <h4 className="tour-title">Confirmar PresenÃ§a</h4>
                <p className="tour-text">No primeiro cartÃ£o, vocÃª confirma sua presenÃ§a e de seus acompanhantes, nos informando em quais momentos do evento irÃ¡ nos prestigiar.</p>
                <div className="tour-actions">
                  <button className="btn-tour-skip" onClick={() => setTourStep(1)}>Voltar</button>
                  <button className="btn-tour-next" onClick={() => setTourStep(3)}>AvanÃ§ar</button>
                </div>
              </>
            )}
            {tourStep === 3 && (
              <>
                <h4 className="tour-title">LocalizaÃ§Ã£o</h4>
                <p className="tour-text">No segundo cartÃ£o, vocÃª pode consultar o endereÃ§o exato, visualizar o mapa do local e abrir rotas direto no seu GPS (Waze ou Maps).</p>
                <div className="tour-actions">
                  <button className="btn-tour-skip" onClick={() => setTourStep(2)}>Voltar</button>
                  <button className="btn-tour-next" onClick={() => setTourStep(4)}>AvanÃ§ar</button>
                </div>
              </>
            )}
            {tourStep === 4 && (
              <>
                <h4 className="tour-title">Enviar Fotos</h4>
                <p className="tour-text">No terceiro cartÃ£o, vocÃª pode enviar e compartilhar as fotos tiradas no batizado para criarmos juntos um lindo Ã¡lbum de recordaÃ§Ãµes!</p>
                <div className="tour-actions">
                  <button className="btn-tour-skip" onClick={() => setTourStep(3)}>Voltar</button>
                  <button className="btn-tour-next" onClick={handleFinishTour}>Concluir</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}


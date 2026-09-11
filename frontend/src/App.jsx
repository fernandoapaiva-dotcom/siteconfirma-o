import { useState, useEffect } from "react";
import Hero from "./components/Hero.jsx";
import RsvpForm from "./components/RsvpForm.jsx";
import PhotoUpload from "./components/PhotoUpload.jsx";
import LocationMaps from "./components/LocationMaps.jsx";
import FloatingElements from "./components/FloatingElements.jsx";
import Gallery from "./components/Gallery.jsx";
import { startResilientUpload } from "./utils/uploader.js";

export default function App() {
  const [activeTab, setActiveTab] = useState(null); // null | "rsvp" | "mapas" | "fotos"
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(1); // 1: Welcome, 2: Cards explanation
  const [backgroundUpload, setBackgroundUpload] = useState({
    active: false,
    progress: 0,
    phase: "",
    statusText: "",
    currentFile: 0,
    totalFiles: 0,
  });
  const [galleryRefresh, setGalleryRefresh] = useState(0);

  useEffect(() => {
    const hasSeen = localStorage.getItem("hasSeenTour_analu");
    if (!hasSeen) {
      setShowTour(true);
    }
  }, []);

  async function handleBackgroundUpload(arquivos, nome) {
    setActiveTab(null); // Fecha a modal imediatamente
    setBackgroundUpload({
      active: true,
      progress: 2,
      phase: "optimizing",
      statusText: `Preparando ${arquivos.length} arquivo(s)...`,
      currentFile: 1,
      totalFiles: arquivos.length,
    });

    await startResilientUpload(arquivos, nome, {
      onProgress: ({ phase, statusText, currentFile, totalFiles, progress }) => {
        setBackgroundUpload((prev) => {
          let resolvedPhase = phase;
          if (statusText && /instável|aguardando|sem conexão|tentativa/i.test(statusText)) {
            resolvedPhase = "reconnecting";
          }
          return {
            ...prev,
            active: true,
            phase: resolvedPhase,
            statusText,
            currentFile: currentFile || prev.currentFile,
            totalFiles: totalFiles || prev.totalFiles,
            progress,
          };
        });
      },
      onSuccess: ({ successCount, total, failures }) => {
        setGalleryRefresh((prev) => prev + 1);
        if (!failures || failures.length === 0) {
          setBackgroundUpload({
            active: true,
            progress: 100,
            phase: "done",
            statusText: total > 1 ? `Todas as ${total} mídias foram enviadas com sucesso!` : "Mídia enviada com sucesso!",
            currentFile: total,
            totalFiles: total,
          });
          setTimeout(() => setBackgroundUpload((prev) => ({ ...prev, active: false })), 6000);
        } else {
          setBackgroundUpload({
            active: true,
            progress: 100,
            phase: "partial",
            statusText: `${successCount} de ${total} mídias enviadas com sucesso (${failures.length} com falha).`,
            currentFile: total,
            totalFiles: total,
          });
          setTimeout(() => setBackgroundUpload((prev) => ({ ...prev, active: false })), 8000);
        }
      },
      onError: (err) => {
        setBackgroundUpload({
          active: true,
          progress: 0,
          phase: "error",
          statusText: err.message || "Erro de conexão ao enviar fotos. Tente novamente mais tarde.",
          currentFile: 0,
          totalFiles: arquivos.length,
        });
        setTimeout(() => setBackgroundUpload((prev) => ({ ...prev, active: false })), 7000);
      },
    });
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

          {/* Menu de Módulos: Proporcional e com breves descrições */}
          <div className="modules-grid">
            <button
              className={`module-card ${showTour && tourStep === 2 ? "tour-highlight" : ""}`}
              onClick={() => setActiveTab("rsvp")}
              title="Confirmar Presença (RSVP)"
            >
              <svg className="module-icon-large" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="6" width="14" height="14" rx="2" />
                <line x1="16" y1="3" x2="16" y2="7" stroke="var(--gold)" />
                <line x1="8" y1="3" x2="8" y2="7" stroke="var(--gold)" />
                <line x1="5" y1="11" x2="19" y2="11" />
                <path d="M12 14c-1-1.2-2.2-.5-2.2.5 0 1 2.2 2.5 2.2 2.5s2.2-1.5 2.2-2.5c0-1-1.2-1.7-2.2-.5z" fill="var(--gold)" stroke="var(--gold)" strokeWidth="0.5" />
              </svg>
              <h3 className="module-title">Presença</h3>
              <p className="module-desc">Confirme sua vinda até 30/08</p>
            </button>

            <button
              className={`module-card ${showTour && tourStep === 3 ? "tour-highlight" : ""}`}
              onClick={() => setActiveTab("mapas")}
              title="Localização e Como Chegar"
            >
              <svg className="module-icon-large" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l7 6v14H5V8l7-6z" />
                <path d="M10 22v-5c0-1.1.9-2 2-2s2 .9 2 2v5" />
                <circle cx="12" cy="11" r="1.5" />
                <path d="M12 2V0M11 1h2" stroke="var(--gold)" strokeWidth="1.5" />
              </svg>
              <h3 className="module-title">Localização</h3>
              <p className="module-desc">Como chegar ao batizado</p>
            </button>

            <button
              className={`module-card ${showTour && tourStep === 4 ? "tour-highlight" : ""}`}
              onClick={() => setActiveTab("fotos")}
              title="Enviar Fotos e Vídeos"
            >
              <svg className="module-icon-large" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" stroke="var(--gold)" />
                <circle cx="12" cy="13" r="1.5" fill="var(--gold)" stroke="var(--gold)" />
              </svg>
              <h3 className="module-title">Enviar Fotos</h3>
              <p className="module-desc">Compartilhe suas recordações</p>
            </button>
          </div>

          {/* Galeria de Fotos */}
          <Gallery refreshTrigger={galleryRefresh} />

          <p className="footer-note">Será uma alegria compartilhar esse momento especial com você.</p>
          
          <p className="invitation-footer-verse">
            "Deixai vir a mim os pequeninos, pois deles é o Reino dos Céus." <br />
            — Mateus 19:14
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

      {/* MODAIS fora do .page — o backdrop-filter do invitation-card cria
          um stacking context que prende o position:fixed dentro do pai.
          Movendo para fora, eles cobrem a tela toda corretamente. */}

      {activeTab && (
        <div className="modal-overlay">
          <div className="modal-content-wrapper">
            <button className="btn-back" onClick={() => setActiveTab(null)}>
              ← Voltar para o Convite
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
          background: backgroundUpload.phase === "done"
            ? "#f0fdf4"
            : backgroundUpload.phase === "error"
            ? "#fef2f2"
            : backgroundUpload.phase === "reconnecting" || backgroundUpload.phase === "partial"
            ? "#fffbeb"
            : "white",
          padding: "14px 18px",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.14)",
          zIndex: 9999,
          borderTop: backgroundUpload.phase === "done"
            ? "3px solid #10b981"
            : backgroundUpload.phase === "error"
            ? "3px solid #ef4444"
            : backgroundUpload.phase === "reconnecting" || backgroundUpload.phase === "partial"
            ? "3px solid #f59e0b"
            : "3px solid var(--gold)",
          transition: "all 0.3s ease"
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", maxWidth: "500px", margin: "0 auto" }}>
            <div style={{ fontSize: "1.6rem", flexShrink: 0, lineHeight: 1 }}>
              {backgroundUpload.phase === "done" && "✅"}
              {backgroundUpload.phase === "error" && "⚠️"}
              {backgroundUpload.phase === "reconnecting" && "🔄"}
              {backgroundUpload.phase === "partial" && "⚠️"}
              {backgroundUpload.phase === "optimizing" && "⚡"}
              {backgroundUpload.phase === "sending" && "📲"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <p style={{
                  margin: "0 0 2px",
                  fontSize: "0.95rem",
                  fontWeight: "700",
                  color: backgroundUpload.phase === "done"
                    ? "#065f46"
                    : backgroundUpload.phase === "error"
                    ? "#991b1b"
                    : backgroundUpload.phase === "reconnecting" || backgroundUpload.phase === "partial"
                    ? "#92400e"
                    : "var(--ink)",
                  fontFamily: "var(--font-display)"
                }}>
                  {backgroundUpload.phase === "done" && "Mídias enviadas com sucesso!"}
                  {backgroundUpload.phase === "error" && "Erro no envio"}
                  {backgroundUpload.phase === "reconnecting" && "Conexão instável — Retomando..."}
                  {backgroundUpload.phase === "partial" && "Envio parcial concluído"}
                  {backgroundUpload.phase === "optimizing" && "Preparando fotos e vídeos..."}
                  {backgroundUpload.phase === "sending" && (
                    backgroundUpload.totalFiles > 1
                      ? `Enviando arquivo ${backgroundUpload.currentFile} de ${backgroundUpload.totalFiles}...`
                      : "Enviando em segundo plano..."
                  )}
                </p>
                {(backgroundUpload.phase === "done" || backgroundUpload.phase === "error" || backgroundUpload.phase === "partial") && (
                  <button
                    onClick={() => setBackgroundUpload(prev => ({ ...prev, active: false }))}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#999",
                      fontSize: "1.1rem",
                      cursor: "pointer",
                      padding: "0 4px",
                      lineHeight: 1,
                    }}
                    title="Fechar"
                  >
                    ✕
                  </button>
                )}
              </div>

              {(backgroundUpload.phase === "sending" || backgroundUpload.phase === "optimizing") && (
                <p style={{ margin: "0 0 8px", fontSize: "0.78rem", color: "#444", lineHeight: 1.45 }}>
                  <span style={{ display: "inline-block", background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", padding: "1px 6px", borderRadius: "4px", fontWeight: "600", fontSize: "0.72rem", marginRight: "5px" }}>🛡️ Segundo plano ativo</span>
                  Pode usar o Instagram ou bloquear a tela: o envio segue sem parar!
                </p>
              )}

              {backgroundUpload.phase === "reconnecting" && (
                <p style={{ margin: "0 0 8px", fontSize: "0.78rem", color: "#92400e", lineHeight: 1.45, fontWeight: "500" }}>
                  {backgroundUpload.statusText || "Aguardando sinal de internet para prosseguir sem perder nada..."}
                </p>
              )}

              {backgroundUpload.phase === "done" && (
                <p style={{ margin: "0 0 4px", fontSize: "0.78rem", color: "#065f46" }}>
                  {backgroundUpload.statusText || "Obrigado por compartilhar seus momentos com a gente!"}
                </p>
              )}

              {backgroundUpload.phase === "partial" && (
                <p style={{ margin: "0 0 4px", fontSize: "0.78rem", color: "#92400e" }}>
                  {backgroundUpload.statusText}
                </p>
              )}

              {backgroundUpload.phase === "error" && (
                <p style={{ margin: "0 0 8px", fontSize: "0.78rem", color: "#991b1b" }}>
                  {backgroundUpload.statusText || "Verifique sua internet e tente novamente."}
                </p>
              )}

              {backgroundUpload.phase !== "error" && (
                <>
                  <div style={{ background: "rgba(0,0,0,0.08)", borderRadius: "8px", height: "6px", overflow: "hidden" }}>
                    <div style={{
                      width: `${backgroundUpload.progress}%`,
                      height: "100%",
                      background: backgroundUpload.phase === "done"
                        ? "#10b981"
                        : backgroundUpload.phase === "reconnecting" || backgroundUpload.phase === "partial"
                        ? "#f59e0b"
                        : "var(--gold)",
                      transition: "width 0.4s ease"
                    }}></div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "4px 0 0" }}>
                    <span style={{ fontSize: "0.72rem", color: "#888" }}>
                      {backgroundUpload.progress}% concluído
                    </span>
                    {backgroundUpload.totalFiles > 0 && backgroundUpload.phase !== "done" && (
                      <span style={{ fontSize: "0.72rem", color: "#888" }}>
                        {backgroundUpload.currentFile} de {backgroundUpload.totalFiles}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showTour && (
        <div className="tour-overlay">
          <div className="tour-card">
            <button className="tour-close-btn" onClick={handleFinishTour} aria-label="Fechar tour">×</button>
            <div className="tour-step-indicator">Passo {tourStep} de 4</div>
            {tourStep === 1 && (
              <>
                <h4 className="tour-title">Seja bem-vindo!</h4>
                <p className="tour-text">Preparamos este espaço com muito amor para o batizado da Analu. Vamos fazer um tour rápido de 15 segundos para te mostrar como interagir com o convite?</p>
                <div className="tour-actions">
                  <button className="btn-tour-skip" onClick={handleFinishTour}>Pular Tour</button>
                  <button className="btn-tour-next" onClick={() => setTourStep(2)}>Começar!</button>
                </div>
              </>
            )}
            {tourStep === 2 && (
              <>
                <h4 className="tour-title">Confirmar Presença</h4>
                <p className="tour-text">No primeiro cartão, você confirma sua presença e de seus acompanhantes, nos informando em quais momentos do evento irá nos prestigiar.</p>
                <div className="tour-actions">
                  <button className="btn-tour-skip" onClick={() => setTourStep(1)}>Voltar</button>
                  <button className="btn-tour-next" onClick={() => setTourStep(3)}>Avançar</button>
                </div>
              </>
            )}
            {tourStep === 3 && (
              <>
                <h4 className="tour-title">Localização</h4>
                <p className="tour-text">No segundo cartão, você pode consultar o endereço exato, visualizar o mapa do local e abrir rotas direto no seu GPS (Waze ou Maps).</p>
                <div className="tour-actions">
                  <button className="btn-tour-skip" onClick={() => setTourStep(2)}>Voltar</button>
                  <button className="btn-tour-next" onClick={() => setTourStep(4)}>Avançar</button>
                </div>
              </>
            )}
            {tourStep === 4 && (
              <>
                <h4 className="tour-title">Enviar Fotos</h4>
                <p className="tour-text">No terceiro cartão, você pode enviar e compartilhar as fotos tiradas no batizado para criarmos juntos um lindo álbum de recordações!</p>
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

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
    setBackgroundUpload({ active: true, progress: 0, text: `Enviando ${arquivos.length} foto/vídeo(s) em partes...` });
    
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
          setBackgroundUpload(prev => ({ ...prev, progress: percent }));
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

      setBackgroundUpload({ active: true, progress: 100, text: "Tudo enviado com sucesso! Obrigado!" });
      setTimeout(() => setBackgroundUpload({ active: false, progress: 0, text: "" }), 4000);
    } catch (err) {
      console.error(err);
      setBackgroundUpload({ active: true, progress: 0, text: "Erro ao enviar. Verifique a internet e tente de novo." });
      setTimeout(() => setBackgroundUpload({ active: false, progress: 0, text: "" }), 5000);
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

          {/* Galeria de Fotos (SÃ³ renderiza se houver fotos ou se o componente tratar) */}
          <Gallery />

        {/* Modal Overlay com Blur de Fundo e Botão Voltar */}
        {activeTab && (
          <div className="modal-overlay">
            <div className="modal-content-wrapper">
              <button
                className="btn-back"
                onClick={() => setActiveTab(null)}
              >
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

        {/* Notificação Flutuante de Upload em Segundo Plano */}
        {backgroundUpload.active && (
          <div style={{ position: "fixed", bottom: "24px", left: "24px", right: "24px", background: "white", padding: "16px", borderRadius: "16px", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", zIndex: 9999, border: "1px solid var(--gold)", transition: "all 0.3s ease" }}>
            <p style={{ margin: "0 0 10px", fontSize: "0.95rem", color: "var(--ink)", fontWeight: "600", fontFamily: "var(--font-display)" }}>{backgroundUpload.text}</p>
            <div style={{ background: "rgba(0,0,0,0.05)", borderRadius: "8px", height: "8px", overflow: "hidden" }}>
              <div style={{ width: `${backgroundUpload.progress}%`, height: "100%", background: "var(--gold)", transition: "width 0.3s ease" }}></div>
            </div>
          </div>
        )}

        {/* Modal do Tour Interativo */}
        {showTour && (
          <div className="tour-overlay">
            <div className="tour-card">
              <button className="tour-close-btn" onClick={handleFinishTour} aria-label="Fechar tour">
                ×
              </button>

              <div className="tour-step-indicator">Passo {tourStep} de 4</div>

              {tourStep === 1 && (
                <>
                  <h4 className="tour-title">Seja bem-vindo!</h4>
                  <p className="tour-text">
                    Preparamos este espaço com muito amor para o batizado da Analu. 
                    Vamos fazer um tour rápido de 15 segundos para te mostrar como interagir com o convite?
                  </p>
                  <div className="tour-actions">
                    <button className="btn-tour-skip" onClick={handleFinishTour}>
                      Pular Tour
                    </button>
                    <button className="btn-tour-next" onClick={() => setTourStep(2)}>
                      Começar!
                    </button>
                  </div>
                </>
              )}

              {tourStep === 2 && (
                <>
                  <h4 className="tour-title">Confirmar Presença</h4>
                  <p className="tour-text">
                    No primeiro cartão, você confirma sua presença e de seus acompanhantes, nos informando em quais momentos do evento irá nos prestigiar.
                  </p>
                  <div className="tour-actions">
                    <button className="btn-tour-skip" onClick={() => setTourStep(1)}>
                      Voltar
                    </button>
                    <button className="btn-tour-next" onClick={() => setTourStep(3)}>
                      Avançar
                    </button>
                  </div>
                </>
              )}

              {tourStep === 3 && (
                <>
                  <h4 className="tour-title">Localização</h4>
                  <p className="tour-text">
                    No segundo cartão, você pode consultar o endereço exato, visualizar o mapa do local e abrir rotas direto no seu GPS (Waze ou Maps).
                  </p>
                  <div className="tour-actions">
                    <button className="btn-tour-skip" onClick={() => setTourStep(2)}>
                      Voltar
                    </button>
                    <button className="btn-tour-next" onClick={() => setTourStep(4)}>
                      Avançar
                    </button>
                  </div>
                </>
              )}

              {tourStep === 4 && (
                <>
                  <h4 className="tour-title">Enviar Fotos</h4>
                  <p className="tour-text">
                    No terceiro cartão, você pode enviar e compartilhar as fotos tiradas no batizado para criarmos juntos um lindo álbum de recordações!
                  </p>
                  <div className="tour-actions">
                    <button className="btn-tour-skip" onClick={() => setTourStep(3)}>
                      Voltar
                    </button>
                    <button className="btn-tour-next" onClick={handleFinishTour}>
                      Concluir
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <p className="footer-note">Será uma alegria compartilhar esse momento especial com você.</p>
        
        {/* Versículo de Mateus no Rodapé */}
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
    </>
  );
}

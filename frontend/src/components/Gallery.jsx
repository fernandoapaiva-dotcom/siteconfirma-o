import { useEffect, useState } from "react";
import ReactDOM from "react-dom";

function driveThumb(fileId, size) {
  return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w" + (size || 400);
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function HeartIcon({ size = 14, color = "white" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function PlayIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function GalleryTile({ item, onOpen }) {
  const isVideo = item.mimeType && item.mimeType.startsWith("video");
  const uploaderName = (item.uploaderName || "Convidado").trim();

  return (
    <div className="gallery-tile" onClick={onOpen}>
      {isVideo ? (
        <video
          src={"/api/video/" + item.id + "#t=0.5"}
          preload="metadata"
          playsInline
          muted
        />
      ) : (
        <img
          src={driveThumb(item.id, 300)}
          alt={"Foto de " + uploaderName}
          loading="lazy"
          onError={(e) => { e.target.style.opacity = "0.15"; }}
        />
      )}

      {isVideo && (
        <div className="gallery-tile-play">
          <PlayIcon size={18} />
        </div>
      )}

      <div className="gallery-tile-badge">
        <div className="gallery-tile-avatar">{uploaderName.charAt(0).toUpperCase()}</div>
        <span className="gallery-tile-name">{uploaderName}</span>
      </div>
    </div>
  );
}

function Lightbox({ items, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex || 0);
  const current = items[idx];
  const isVideo = current.mimeType && current.mimeType.startsWith("video");

  useEffect(() => {
    window.history.pushState({ lightbox: true }, "");
    const handlePop = () => onClose();
    window.addEventListener("popstate", handlePop);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", handlePop);
      document.body.style.overflow = "";
    };
  }, []);

  const close = () => {
    if (window.history.state && window.history.state.lightbox) window.history.back();
    else onClose();
  };

  const next = (e) => { e.stopPropagation(); setIdx((p) => (p + 1) % items.length); };
  const prev = (e) => { e.stopPropagation(); setIdx((p) => (p - 1 + items.length) % items.length); };

  const uploaderName = (current.uploaderName || "").trim();

  const overlay = (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        width: "100vw", height: "100vh", background: "#000", zIndex: 99999,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}
      onClick={close}
    >
      <div
        style={{
          flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 16px", background: "linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)",
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", color: "white", padding: "5px 14px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "700" }}>
            {uploaderName}
          </span>
          {items.length > 1 && (
            <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.78rem" }}>{idx + 1} / {items.length}</span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); close(); }}
          style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "white", borderRadius: "50%", width: "38px", height: "38px", fontSize: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          &times;
        </button>
      </div>

      <div
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
        onClick={close}
      >
        {isVideo ? (
          <div
            className="lightbox-media-enter"
            style={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}
            onClick={(e) => e.stopPropagation()}
          >
            <video
              key={current.id}
              src={"/api/video/" + current.id}
              controls
              playsInline
              autoPlay
              style={{ maxWidth: "100vw", maxHeight: "calc(100vh - 120px)", width: "100%", height: "100%", objectFit: "contain", display: "block", border: "none", outline: "none" }}
            />
          </div>
        ) : (
          <img
            key={current.id}
            className="lightbox-media-enter"
            src={driveThumb(current.id, 1600)}
            alt={"Foto de " + uploaderName}
            style={{ display: "block", maxWidth: "100vw", maxHeight: "100vh", width: "auto", height: "auto", objectFit: "contain" }}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

      {items.length > 1 && (
        <button
          onClick={prev}
          style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", border: "none", color: "white", borderRadius: "50%", width: "42px", height: "42px", fontSize: "22px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3 }}
        >
          &lsaquo;
        </button>
      )}
      {items.length > 1 && (
        <button
          onClick={next}
          style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", border: "none", color: "white", borderRadius: "50%", width: "42px", height: "42px", fontSize: "22px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3 }}
        >
          &rsaquo;
        </button>
      )}

      <div
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 20px 28px", display: "flex", justifyContent: "center", gap: "16px", alignItems: "center", background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)", zIndex: 2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            fetch("/api/gallery/" + current.id + "/like", { method: "POST" }).catch(() => {});
          }}
          style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)", border: "none", color: "white", borderRadius: "24px", padding: "8px 18px", fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <HeartIcon />
          Curtir
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const url = isVideo
              ? "https://drive.google.com/file/d/" + current.id + "/view?usp=sharing"
              : driveThumb(current.id, 1200);
            if (navigator.share) {
              navigator.share({ title: "Batizado da Analu", url }).catch(() => {});
            } else {
              navigator.clipboard.writeText(url).then(() => alert("Link copiado!")).catch(() => {});
            }
          }}
          style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)", border: "none", color: "white", borderRadius: "24px", padding: "8px 18px", fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <ShareIcon />
          Compartilhar
        </button>
      </div>
    </div>
  );

  return ReactDOM.createPortal(overlay, document.body);
}

export default function Gallery({ refreshTrigger }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { items, index }
  const [activeTab, setActiveTab] = useState("fotos");

  useEffect(() => { fetchGallery(); }, [refreshTrigger]);

  async function fetchGallery() {
    try {
      const res = await fetch("/api/gallery");
      if (!res.ok) throw new Error("Erro ao carregar.");
      setPhotos(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const photoItems = photos.filter((p) => !(p.mimeType && p.mimeType.startsWith("video")));
  const videoItems = photos.filter((p) => p.mimeType && p.mimeType.startsWith("video"));

  useEffect(() => {
    // Se a aba ativa ficar sem conteúdo (ex: só chegaram vídeos), muda pra que tem algo.
    if (activeTab === "fotos" && photoItems.length === 0 && videoItems.length > 0) {
      setActiveTab("videos");
    } else if (activeTab === "videos" && videoItems.length === 0 && photoItems.length > 0) {
      setActiveTab("fotos");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  if (photos.length === 0 && !loading) return null;

  const activeItems = activeTab === "fotos" ? photoItems : videoItems;

  return (
    <>
      <div className="section" style={{ marginTop: "24px" }}>
        <h2 className="section-title">Galeria</h2>
        <p className="section-subtitle">Momentos eternizados por vocês</p>

        {loading ? (
          <p style={{ textAlign: "center", color: "var(--sage-deep)" }}>Carregando...</p>
        ) : error ? (
          <p style={{ textAlign: "center", color: "red" }}>{error}</p>
        ) : (
          <div style={{ marginTop: "18px" }}>
            <div className="gallery-tabs">
              <button
                className={`gallery-tab ${activeTab === "fotos" ? "active" : ""}`}
                onClick={() => setActiveTab("fotos")}
              >
                <CameraIcon />
                Fotos
                <span className="gallery-tab-count">{photoItems.length}</span>
              </button>
              <button
                className={`gallery-tab ${activeTab === "videos" ? "active" : ""}`}
                onClick={() => setActiveTab("videos")}
              >
                <VideoIcon />
                Vídeos
                <span className="gallery-tab-count">{videoItems.length}</span>
              </button>
            </div>

            {activeItems.length === 0 ? (
              <p className="gallery-empty-tab">
                {activeTab === "fotos" ? "Nenhuma foto enviada ainda." : "Nenhum vídeo enviado ainda."}
              </p>
            ) : (
              <div className="gallery-grid">
                {activeItems.map((item, i) => (
                  <GalleryTile
                    key={item.id}
                    item={item}
                    onOpen={() => setLightbox({ items: activeItems, index: i })}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {lightbox && (
        <Lightbox
          items={lightbox.items}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

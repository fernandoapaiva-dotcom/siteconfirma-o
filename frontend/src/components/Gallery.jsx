import React, { useEffect, useState, useCallback } from "react";

function driveThumb(fileId, size) {
  if (!size) size = 400;
  return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w" + size;
}

export default function Gallery() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    fetchGallery();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (lightboxIndex !== null) setLightboxIndex(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [lightboxIndex]);

  async function fetchGallery() {
    try {
      const res = await fetch("/api/gallery");
      if (!res.ok) throw new Error("Erro ao carregar a galeria.");
      const data = await res.json();
      setPhotos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleLike = async (e, id, index) => {
    e.stopPropagation();
    try {
      const res = await fetch("/api/gallery/" + id + "/like", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setPhotos(prev => prev.map((p, i) => i === index ? { ...p, likes: data.likes } : p));
      }
    } catch (err) { console.error(err); }
  };

  const handleShare = async (e, photo) => {
    e.stopPropagation();
    const shareUrl = "https://drive.google.com/file/d/" + photo.id + "/view";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Batizado da Analu", text: "Confira essa foto de " + photo.uploaderName + "!", url: shareUrl });
      } catch (err) { if (err.name !== "AbortError") console.error(err); }
    } else {
      try { await navigator.clipboard.writeText(shareUrl); alert("Link copiado!"); }
      catch { alert("Abra em: " + shareUrl); }
    }
  };

  const openLightbox = (index) => {
    setLightboxIndex(index);
    window.history.pushState({ lightbox: true }, "");
  };

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    if (window.history.state && window.history.state.lightbox) window.history.back();
  }, []);

  const nextPhoto = (e) => { e.stopPropagation(); setLightboxIndex(prev => (prev + 1) % photos.length); };
  const prevPhoto = (e) => { e.stopPropagation(); setLightboxIndex(prev => (prev - 1 + photos.length) % photos.length); };

  if (photos.length === 0 && !loading) return null;

  const current = lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <React.Fragment>
      <div className="section" style={{ marginTop: "24px" }}>
        <h2 className="section-title">Galeria de Fotos</h2>
        <p className="section-subtitle">Momentos eternizados</p>

        {loading ? (
          <p style={{ textAlign: "center", color: "var(--sage-deep)" }}>Carregando fotos...</p>
        ) : error ? (
          <p style={{ textAlign: "center", color: "red" }}>{error}</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px", marginTop: "20px" }}>
            {photos.map((photo, index) => {
              const isVideo = photo.mimeType && photo.mimeType.startsWith("video");
              const thumbUrl = driveThumb(photo.id, 400);
              return (
                <div key={photo.id} onClick={() => openLightbox(index)} style={{ position: "relative", cursor: "pointer", borderRadius: "12px", overflow: "hidden", aspectRatio: "1", boxShadow: "0 4px 10px rgba(0,0,0,0.12)", backgroundColor: "#e8e8e8" }}>
                  <div style={{ position: "absolute", top: "8px", left: "8px", background: "rgba(255,255,255,0.9)", padding: "3px 8px", borderRadius: "20px", fontSize: "0.68rem", fontWeight: "700", color: "#333", zIndex: 2, maxWidth: "calc(100% - 20px)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {photo.uploaderName ? photo.uploaderName.trim() : ""}
                  </div>
                  <img src={thumbUrl} alt={isVideo ? "Video" : "Foto de " + photo.uploaderName} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e){ e.target.style.opacity="0.2"; }} />
                  {isVideo && (
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.55)", borderRadius: "50%", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
                    </div>
                  )}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.75))", padding: "28px 8px 8px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 2 }}>
                    <button onClick={function(e){ handleLike(e, photo.id, index); }} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "white", borderRadius: "20px", padding: "4px 10px", fontSize: "0.78rem", cursor: "pointer", display: "flex", gap: "4px", alignItems: "center" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                      {photo.likes || 0}
                    </button>
                    <button onClick={function(e){ handleShare(e, photo); }} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {current && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.97)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }} onClick={closeLightbox}>
          <button onClick={function(e){ e.stopPropagation(); closeLightbox(); }} style={{ position: "absolute", top: "16px", right: "16px", background: "rgba(255,255,255,0.2)", border: "none", color: "white", fontSize: "22px", cursor: "pointer", borderRadius: "50%", width: "42px", height: "42px", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001, lineHeight: 1 }}>&times;</button>

          <div style={{ position: "absolute", top: "16px", left: "16px", zIndex: 10001, color: "white", display: "flex", flexDirection: "column", gap: "8px" }} onClick={function(e){ e.stopPropagation(); }}>
            <span style={{ background: "rgba(255,255,255,0.18)", padding: "4px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "600" }}>{current.uploaderName ? current.uploaderName.trim() : ""}</span>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={function(e){ handleLike(e, current.id, lightboxIndex); }} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "white", borderRadius: "20px", padding: "6px 14px", fontSize: "0.9rem", cursor: "pointer", display: "flex", gap: "6px", alignItems: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                {current.likes || 0}
              </button>
              <button onClick={function(e){ handleShare(e, current); }} style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "white", borderRadius: "20px", padding: "6px 14px", fontSize: "0.85rem", cursor: "pointer", display: "flex", gap: "6px", alignItems: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                Compartilhar
              </button>
            </div>
          </div>

          {photos.length > 1 && (<button onClick={prevPhoto} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: "28px", cursor: "pointer", borderRadius: "50%", width: "46px", height: "46px", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001 }}>&#10094;</button>)}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }} onClick={function(e){ e.stopPropagation(); }}>
            {current.mimeType && current.mimeType.startsWith("video") ? (
              <iframe key={current.id} src={"https://drive.google.com/file/d/" + current.id + "/preview"} style={{ width: "90vw", height: "75vh", border: "none", borderRadius: "8px" }} allow="autoplay; fullscreen" allowFullScreen></iframe>
            ) : (
              <img key={current.id} src={driveThumb(current.id, 1600)} alt={"Foto de " + current.uploaderName} style={{ maxHeight: "80vh", maxWidth: "92vw", objectFit: "contain", borderRadius: "8px", boxShadow: "0 0 30px rgba(0,0,0,0.6)" }} />
            )}
          </div>

          {photos.length > 1 && (
            <React.Fragment>
              <div style={{ position: "absolute", bottom: "18px", color: "rgba(255,255,255,0.75)", fontSize: "0.85rem" }}>{lightboxIndex + 1} / {photos.length}</div>
              <button onClick={nextPhoto} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: "28px", cursor: "pointer", borderRadius: "50%", width: "46px", height: "46px", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001 }}>&#10095;</button>
            </React.Fragment>
          )}
        </div>
      )}
    </React.Fragment>
  );
}
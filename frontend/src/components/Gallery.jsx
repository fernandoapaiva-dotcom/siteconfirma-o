import React, { useEffect, useState } from "react";

export default function Gallery() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    fetchGallery();
  }, []);

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

  const handleLike = async (e, id, currentIndex) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/gallery/${id}/like`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const updated = [...photos];
        updated[currentIndex].likes = data.likes;
        setPhotos(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleShare = async (e, photo) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Batizado da Analu",
          text: `Confira essa foto de ${photo.uploaderName}!`,
          url: photo.fileUrl || window.location.href,
        });
      } catch (err) {
        console.error("Erro ao compartilhar", err);
      }
    } else {
      alert("O compartilhamento nativo não é suportado no seu navegador.");
    }
  };

  const openLightbox = (index) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  
  const nextPhoto = (e) => {
    e.stopPropagation();
    setLightboxIndex((prev) => (prev + 1) % photos.length);
  };
  const prevPhoto = (e) => {
    e.stopPropagation();
    setLightboxIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  if (photos.length === 0 && !loading) return null;

  return (
    <>
      <div className="section" style={{ marginTop: "24px" }}>
        <h2 className="section-title">Galeria de Fotos</h2>
        <p className="section-subtitle">Momentos eternizados</p>

        {loading ? (
          <p style={{ textAlign: "center", color: "var(--sage-deep)" }}>Carregando fotos...</p>
        ) : error ? (
          <p style={{ textAlign: "center", color: "red" }}>{error}</p>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "12px",
            marginTop: "20px"
          }}>
            {photos.map((photo, index) => {
              const isVideo = photo.mimeType?.startsWith("video");
              // Use um thumbnail maior ajustando o link gerado pelo Google Drive
              const thumbUrl = photo.thumbnailUrl ? photo.thumbnailUrl.replace(/=s\d+.*/, '=s600') : photo.fileUrl;
              
              return (
                <div 
                  key={photo.id}
                  onClick={() => openLightbox(index)}
                  style={{
                    position: "relative",
                    cursor: "pointer",
                    borderRadius: "12px",
                    overflow: "hidden",
                    aspectRatio: "1",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
                    backgroundColor: "#f5f5f5"
                  }}
                >
                  {/* Etiqueta com nome do usuário */}
                  <div style={{
                    position: "absolute", top: "8px", left: "8px",
                    background: "rgba(255,255,255,0.85)", backdropFilter: "blur(4px)",
                    padding: "4px 8px", borderRadius: "20px",
                    fontSize: "0.7rem", fontWeight: "600", color: "var(--ink)", zIndex: 2,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }}>
                    {photo.uploaderName}
                  </div>

                  {isVideo ? (
                    <>
                      <img
                        src={thumbUrl}
                        alt="Video Thumbnail"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <div style={{
                        position: "absolute", top: "50%", left: "50%",
                        transform: "translate(-50%, -50%)",
                        background: "rgba(0,0,0,0.5)", borderRadius: "50%",
                        width: "40px", height: "40px", display: "flex",
                        alignItems: "center", justifyContent: "center", zIndex: 1
                      }}>
                        <span style={{ color: "white", fontSize: "20px", marginLeft: "3px" }}>?</span>
                      </div>
                    </>
                  ) : (
                    <img
                      src={thumbUrl}
                      alt={`Foto de ${photo.uploaderName}`}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}

                  {/* Barra inferior de ações */}
                  <div style={{
                    position: "absolute", bottom: "0", left: "0", right: "0",
                    background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                    padding: "20px 8px 8px 8px", display: "flex", justifyContent: "space-between",
                    alignItems: "center", zIndex: 2
                  }}>
                    <button 
                      onClick={(e) => handleLike(e, photo.id, index)}
                      style={{
                        background: "rgba(255,255,255,0.2)", border: "none",
                        color: "white", borderRadius: "20px", padding: "4px 10px",
                        fontSize: "0.8rem", cursor: "pointer", display: "flex", gap: "4px",
                        alignItems: "center", backdropFilter: "blur(4px)"
                      }}
                    >
                      ?? {photo.likes || 0}
                    </button>
                    
                    <button 
                      onClick={(e) => handleShare(e, photo)}
                      style={{
                        background: "transparent", border: "none", color: "white",
                        fontSize: "1.1rem", cursor: "pointer", padding: "4px"
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lightboxIndex !== null && photos.length > 0 && (
        <div 
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.95)", zIndex: 9999,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
          }}
          onClick={closeLightbox}
        >
          <button onClick={closeLightbox} style={{
            position: "absolute", top: "20px", right: "20px",
            background: "transparent", border: "none", color: "white", fontSize: "36px", cursor: "pointer", zIndex: 10000
          }}>&times;</button>

          {photos.length > 1 && (
            <button onClick={prevPhoto} style={{
              position: "absolute", left: "20px", top: "50%", transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: "32px", cursor: "pointer",
              borderRadius: "50%", width: "50px", height: "50px", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000
            }}>&#10094;</button>
          )}

          {/* Nome do usuário e Like no topo da tela cheia */}
          <div style={{
            position: "absolute", top: "20px", left: "20px", zIndex: 10000,
            color: "white", display: "flex", flexDirection: "column", gap: "10px"
          }} onClick={(e) => e.stopPropagation()}>
            <span style={{ background: "rgba(255,255,255,0.2)", padding: "4px 12px", borderRadius: "20px", fontSize: "0.9rem", fontWeight: "600" }}>
              {photos[lightboxIndex].uploaderName}
            </span>
            <div style={{ display: "flex", gap: "12px" }}>
              <button 
                onClick={(e) => handleLike(e, photos[lightboxIndex].id, lightboxIndex)}
                style={{
                  background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: "20px",
                  padding: "6px 14px", fontSize: "1rem", cursor: "pointer", display: "flex", gap: "6px", alignItems: "center"
                }}
              >
                ?? {photos[lightboxIndex].likes || 0}
              </button>
              <button 
                onClick={(e) => handleShare(e, photos[lightboxIndex])}
                style={{
                  background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: "20px",
                  padding: "6px 14px", fontSize: "1rem", cursor: "pointer", display: "flex", gap: "6px", alignItems: "center"
                }}
              >
                Compartilhar
              </button>
            </div>
          </div>

          <div style={{ width: "100%", height: "80%", display: "flex", justifyContent: "center", alignItems: "center" }}>
            {photos[lightboxIndex].mimeType?.startsWith("video") ? (
              <iframe
                src={`https://drive.google.com/file/d/${photos[lightboxIndex].id}/preview`}
                style={{ width: "90vw", height: "85vh", border: "none", borderRadius: "8px" }}
                allow="autoplay"
                allowFullScreen
                onClick={(e) => e.stopPropagation()}
              ></iframe>
            ) : (
              <img 
                src={photos[lightboxIndex].thumbnailUrl ? photos[lightboxIndex].thumbnailUrl.replace(/=s\d+.*/, '=s1600') : photos[lightboxIndex].fileUrl}
                alt="Expandida" 
                style={{ maxHeight: "85vh", maxWidth: "90vw", objectFit: "contain", borderRadius: "8px", boxShadow: "0 0 20px rgba(0,0,0,0.5)" }}
                onClick={(e) => e.stopPropagation()} 
              />
            )}
          </div>

          {photos.length > 1 && (
            <div style={{ position: "absolute", bottom: "20px", color: "white", fontSize: "0.9rem", opacity: 0.8 }}>
              {lightboxIndex + 1} / {photos.length}
            </div>
          )}

          {photos.length > 1 && (
            <button onClick={nextPhoto} style={{
              position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: "32px", cursor: "pointer",
              borderRadius: "50%", width: "50px", height: "50px", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000
            }}>&#10095;</button>
          )}
        </div>
      )}
    </>
  );
}

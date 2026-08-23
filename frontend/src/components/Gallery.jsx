import React, { useEffect, useState } from "react";

export default function Gallery() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estado do Lightbox (Tela cheia)
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [lightboxPhotos, setLightboxPhotos] = useState([]); // fotos daquele grupo

  useEffect(() => {
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
    fetchGallery();
  }, []);

  // Agrupa fotos por nome
  const groupedPhotos = photos.reduce((acc, photo) => {
    if (!acc[photo.uploaderName]) acc[photo.uploaderName] = [];
    acc[photo.uploaderName].push(photo);
    return acc;
  }, {});

  const openLightbox = (group, index) => {
    setLightboxPhotos(group);
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    setLightboxPhotos([]);
  };

  const nextPhoto = (e) => {
    e.stopPropagation();
    setLightboxIndex((prev) => (prev + 1) % lightboxPhotos.length);
  };

  const prevPhoto = (e) => {
    e.stopPropagation();
    setLightboxIndex((prev) => (prev - 1 + lightboxPhotos.length) % lightboxPhotos.length);
  };

  // NÃ£o renderiza o card de galeria se nÃ£o houver fotos ainda
  if (photos.length === 0 && !loading) {
    return null;
  }

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
          <div className="gallery-container">
            {Object.keys(groupedPhotos).map((uploader) => (
              <div key={uploader} className="gallery-group" style={{ marginBottom: "24px" }}>
                <h4 style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--gold-deep)",
                  fontSize: "1.1rem",
                  margin: "0 0 12px 0",
                  borderBottom: "1px solid var(--line)",
                  paddingBottom: "4px"
                }}>
                  Fotos de {uploader}
                </h4>
                
                <div style={{
                  display: "flex",
                  gap: "12px",
                  overflowX: "auto",
                  paddingBottom: "12px",
                  scrollSnapType: "x mandatory",
                  scrollbarWidth: "thin",
                  WebkitOverflowScrolling: "touch"
                }}>
                  {groupedPhotos[uploader].map((photo, index) => (
                    photo.mimeType?.startsWith("video") ? (
                      <video
                        key={photo.id}
                        src={photo.fileUrl}
                        onClick={() => openLightbox(groupedPhotos[uploader], index)}
                        style={{
                          height: "140px",
                          width: "140px",
                          objectFit: "cover",
                          borderRadius: "8px",
                          scrollSnapAlign: "start",
                          cursor: "pointer",
                          boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                          flexShrink: 0
                        }}
                        muted
                      />
                    ) : (
                      <img
                        key={photo.id}
                        src={photo.thumbnailUrl || photo.fileUrl}
                        alt={`Foto de ${uploader}`}
                        onClick={() => openLightbox(groupedPhotos[uploader], index)}
                        style={{
                          height: "140px",
                          width: "140px",
                          objectFit: "cover",
                          borderRadius: "8px",
                          scrollSnapAlign: "start",
                          cursor: "pointer",
                          boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                          flexShrink: 0
                        }}
                      />
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox - Tela Cheia */}
      {lightboxIndex !== null && lightboxPhotos.length > 0 && (
        <div 
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.95)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(5px)"
          }}
          onClick={closeLightbox}
        >
          {/* BotÃ£o Fechar */}
          <button 
            onClick={closeLightbox}
            style={{
              position: "absolute",
              top: "20px", right: "20px",
              background: "transparent", border: "none",
              color: "white", fontSize: "36px", cursor: "pointer",
              padding: "10px", zIndex: 10000
            }}
          >
            &times;
          </button>

          {/* BotÃ£o Anterior */}
          {lightboxPhotos.length > 1 && (
            <button 
              onClick={prevPhoto}
              style={{
                position: "absolute", left: "20px", top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.15)", border: "none",
                color: "white", fontSize: "32px", cursor: "pointer",
                borderRadius: "50%", width: "50px", height: "50px",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 10000
              }}
            >
              &#10094;
            </button>
          )}

          {/* Imagem ou Video Expandido */}
          {lightboxPhotos[lightboxIndex].mimeType?.startsWith("video") ? (
            <video 
              src={lightboxPhotos[lightboxIndex].fileUrl} 
              controls
              autoPlay
              style={{
                maxHeight: "85vh",
                maxWidth: "90vw",
                objectFit: "contain",
                borderRadius: "4px",
                boxShadow: "0 0 20px rgba(0,0,0,0.5)"
              }}
              onClick={(e) => e.stopPropagation()} 
            />
          ) : (
            <img 
              src={lightboxPhotos[lightboxIndex].fileUrl} 
              alt="Expandida" 
              style={{
                maxHeight: "85vh",
                maxWidth: "90vw",
                objectFit: "contain",
                borderRadius: "4px",
                boxShadow: "0 0 20px rgba(0,0,0,0.5)"
              }}
              onClick={(e) => e.stopPropagation()} 
            />
          )}

          {/* Indicador NumÃ©rico (1 de X) */}
          {lightboxPhotos.length > 1 && (
            <div style={{
              position: "absolute", bottom: "20px",
              color: "white", fontFamily: "var(--font-body)",
              fontSize: "0.9rem", opacity: 0.8
            }}>
              {lightboxIndex + 1} / {lightboxPhotos.length}
            </div>
          )}

          {/* BotÃ£o PrÃ³ximo */}
          {lightboxPhotos.length > 1 && (
            <button 
              onClick={nextPhoto}
              style={{
                position: "absolute", right: "20px", top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.15)", border: "none",
                color: "white", fontSize: "32px", cursor: "pointer",
                borderRadius: "50%", width: "50px", height: "50px",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 10000
              }}
            >
              &#10095;
            </button>
          )}
        </div>
      )}
    </>
  );
}

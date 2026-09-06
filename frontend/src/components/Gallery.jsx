import React, { useEffect, useState, useCallback, useRef } from "react";
import ReactDOM from "react-dom";

function driveThumb(fileId, size) {
  return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w" + (size || 400);
}

function ShareIcon() {
  return React.createElement("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round" },
    React.createElement("circle", { cx: "18", cy: "5", r: "3" }),
    React.createElement("circle", { cx: "6", cy: "12", r: "3" }),
    React.createElement("circle", { cx: "18", cy: "19", r: "3" }),
    React.createElement("line", { x1: "8.59", y1: "13.51", x2: "15.42", y2: "17.49" }),
    React.createElement("line", { x1: "15.41", y1: "6.51", x2: "8.59", y2: "10.49" })
  );
}

function HeartIcon() {
  return React.createElement("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "currentColor" },
    React.createElement("path", { d: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" })
  );
}

function PlayIcon() {
  return React.createElement("svg", { width: 22, height: 22, viewBox: "0 0 24 24", fill: "white" },
    React.createElement("polygon", { points: "5,3 19,12 5,21" })
  );
}

// Carousel de um unico uploader
function UploaderCarousel({ uploader, photos, onOpenLightbox }) {
  const [current, setCurrent] = useState(0);
  const thumbsRef = useRef(null);

  const goTo = (idx) => {
    setCurrent(idx);
    // Rolar thumbnail para visibilidade
    if (thumbsRef.current) {
      const thumb = thumbsRef.current.children[idx];
      if (thumb) thumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  const prev = (e) => { e.stopPropagation(); goTo((current - 1 + photos.length) % photos.length); };
  const next = (e) => { e.stopPropagation(); goTo((current + 1) % photos.length); };

  const photo = photos[current];
  const isVideo = photo.mimeType && photo.mimeType.startsWith("video");

  const handleShare = async (e) => {
    e.stopPropagation();
    const shareUrl = "https://drive.google.com/thumbnail?id=" + photo.id + "&sz=w1200";
    if (isVideo) {
      // Para video compartilha link de visualizacao publica
      const videoUrl = "https://drive.google.com/file/d/" + photo.id + "/view?usp=sharing";
      if (navigator.share) {
        try { await navigator.share({ title: "Batizado da Analu - " + uploader, url: videoUrl }); } catch(e) {}
      } else {
        try { await navigator.clipboard.writeText(videoUrl); alert("Link copiado!"); } catch { alert(videoUrl); }
      }
      return;
    }
    if (navigator.share) {
      try { await navigator.share({ title: "Batizado da Analu - " + uploader, url: shareUrl }); } catch(e) {}
    } else {
      try { await navigator.clipboard.writeText(shareUrl); alert("Link copiado!"); } catch { alert(shareUrl); }
    }
  };

  return React.createElement("div", {
    style: { marginBottom: "28px", background: "white", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }
  },
    // Header com nome e contador
    React.createElement("div", {
      style: { padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f0ebe0" }
    },
      React.createElement("div", {
        style: { display: "flex", alignItems: "center", gap: "8px" }
      },
        React.createElement("div", {
          style: { width: "34px", height: "34px", borderRadius: "50%", background: "var(--gold-deep, #b8962e)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.85rem", fontWeight: "700" }
        }, uploader.trim().charAt(0).toUpperCase()),
        React.createElement("span", {
          style: { fontFamily: "var(--font-display, serif)", color: "var(--gold-deep, #b8962e)", fontWeight: "700", fontSize: "1rem" }
        }, uploader.trim())
      ),
      React.createElement("span", {
        style: { background: "#f5f0e8", borderRadius: "20px", padding: "4px 12px", fontSize: "0.8rem", color: "#888", fontWeight: "600" }
      }, photos.length + " " + (photos.length === 1 ? "arquivo" : "arquivos"))
    ),

    // Area principal do carousel
    React.createElement("div", {
      style: { position: "relative", aspectRatio: "4/3", background: "#1a1a1a", cursor: "pointer" },
      onClick: function() { onOpenLightbox(photos, current); }
    },
      isVideo
        ? React.createElement(React.Fragment, null,
            React.createElement("img", {
              src: driveThumb(photo.id, 800),
              alt: "Video thumbnail",
              style: { width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 },
              onError: function(e) { e.target.style.display = "none"; }
            }),
            React.createElement("div", {
              style: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(0,0,0,0.6)", borderRadius: "50%", width: "60px", height: "60px", display: "flex", alignItems: "center", justifyContent: "center" }
            }, React.createElement(PlayIcon))
          )
        : React.createElement("img", {
            src: driveThumb(photo.id, 800),
            alt: "Foto de " + uploader,
            style: { width: "100%", height: "100%", objectFit: "cover" },
            onError: function(e) { e.target.style.opacity = "0.2"; }
          }),

      // Contador central
      photos.length > 1 && React.createElement("div", {
        style: { position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.55)", color: "white", borderRadius: "12px", padding: "3px 10px", fontSize: "0.78rem", fontWeight: "600" }
      }, (current + 1) + " / " + photos.length),

      // Botoes prev/next
      photos.length > 1 && React.createElement(React.Fragment, null,
        React.createElement("button", {
          onClick: prev,
          style: { position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.4)", border: "none", color: "white", borderRadius: "50%", width: "36px", height: "36px", cursor: "pointer", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }
        }, "\u2039"),
        React.createElement("button", {
          onClick: next,
          style: { position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.4)", border: "none", color: "white", borderRadius: "50%", width: "36px", height: "36px", cursor: "pointer", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }
        }, "\u203a")
      )
    ),

    // Thumbnails strip
    photos.length > 1 && React.createElement("div", {
      ref: thumbsRef,
      style: { display: "flex", gap: "6px", padding: "8px 12px", overflowX: "auto", scrollbarWidth: "none", background: "#faf8f4" }
    },
      photos.map(function(p, i) {
        const isVid = p.mimeType && p.mimeType.startsWith("video");
        return React.createElement("div", {
          key: p.id,
          onClick: function() { goTo(i); },
          style: { flexShrink: 0, width: "52px", height: "52px", borderRadius: "8px", overflow: "hidden", cursor: "pointer", border: i === current ? "2.5px solid var(--gold-deep, #b8962e)" : "2.5px solid transparent", position: "relative", transition: "border 0.15s" }
        },
          React.createElement("img", {
            src: driveThumb(p.id, 100),
            alt: "",
            style: { width: "100%", height: "100%", objectFit: "cover", display: "block" }
          }),
          isVid && React.createElement("div", {
            style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }
          }, React.createElement("svg", { width: 12, height: 12, viewBox: "0 0 24 24", fill: "white" }, React.createElement("polygon", { points: "5,3 19,12 5,21" })))
        );
      })
    ),

    // Footer com curtir e compartilhar
    React.createElement("div", {
      style: { padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }
    },
      React.createElement("div", {
        style: { display: "flex", alignItems: "center", gap: "6px", color: "#888", fontSize: "0.9rem" }
      },
        React.createElement(HeartIcon),
        React.createElement("span", null, photo.likes || 0)
      ),
      React.createElement("button", {
        onClick: handleShare,
        style: { background: "none", border: "none", cursor: "pointer", color: "#888", display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", padding: "4px 8px" }
      },
        React.createElement(ShareIcon),
        "Compartilhar"
      )
    )
  );
}

// Lightbox global

function Lightbox({ photos, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex || 0);
  const current = photos[idx];
  const isVideo = current.mimeType && current.mimeType.startsWith("video");

  useEffect(() => {
    // Push history para o botao voltar do Android funcionar
    window.history.pushState({ lightbox: true }, "");
    const handlePop = () => onClose();
    window.addEventListener("popstate", handlePop);
    // Bloqueia scroll da pagina de fundo
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

  const next = (e) => { e.stopPropagation(); setIdx(function(p) { return (p + 1) % photos.length; }); };
  const prev = (e) => { e.stopPropagation(); setIdx(function(p) { return (p - 1 + photos.length) % photos.length; }); };

  const overlay = React.createElement("div", {
    style: {
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      width: "100vw",
      height: "100vh",
      background: "#000",
      zIndex: 99999,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    },
    onClick: close
  },

    // === BARRA SUPERIOR ===
    React.createElement("div", {
      style: {
        flexShrink: 0,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)",
        position: "absolute",
        top: 0, left: 0, right: 0,
        zIndex: 2
      },
      onClick: function(e) { e.stopPropagation(); }
    },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
        React.createElement("span", {
          style: {
            background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)",
            color: "white", padding: "5px 14px", borderRadius: "20px",
            fontSize: "0.85rem", fontWeight: "700"
          }
        }, current.uploaderName ? current.uploaderName.trim() : ""),
        photos.length > 1 && React.createElement("span", {
          style: { color: "rgba(255,255,255,0.55)", fontSize: "0.78rem" }
        }, (idx + 1) + " / " + photos.length)
      ),
      React.createElement("button", {
        onClick: function(e) { e.stopPropagation(); close(); },
        style: {
          background: "rgba(255,255,255,0.18)", border: "none", color: "white",
          borderRadius: "50%", width: "38px", height: "38px", fontSize: "20px",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
        }
      }, "\u00d7")
    ),

    // === AREA CENTRAL DA MIDIA ===
    React.createElement("div", {
      style: {
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      },
      onClick: close
    },
      isVideo
        ? React.createElement("div", {
            style: { width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" },
            onClick: function(e) { e.stopPropagation(); }
          },
            React.createElement("iframe", {
              key: current.id,
              src: "https://drive.google.com/file/d/" + current.id + "/preview",
              style: { width: "100vw", height: "56.25vw", maxHeight: "100vh", border: "none" },
              allow: "autoplay; fullscreen",
              allowFullScreen: true
            })
          )
        : React.createElement("img", {
            key: current.id,
            src: driveThumb(current.id, 1600),
            alt: "Foto de " + (current.uploaderName || ""),
            style: {
              display: "block",
              maxWidth: "100vw",
              maxHeight: "100vh",
              width: "auto",
              height: "auto",
              objectFit: "contain"
            },
            onClick: function(e) { e.stopPropagation(); }
          })
    ),

    // === SETAS DE NAVEGACAO ===
    photos.length > 1 && React.createElement("button", {
      onClick: prev,
      style: {
        position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)",
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
        border: "none", color: "white", borderRadius: "50%",
        width: "42px", height: "42px", fontSize: "22px", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3
      }
    }, "\u276c"),

    photos.length > 1 && React.createElement("button", {
      onClick: next,
      style: {
        position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
        border: "none", color: "white", borderRadius: "50%",
        width: "42px", height: "42px", fontSize: "22px", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3
      }
    }, "\u276d"),

    // === BARRA INFERIOR ===
    React.createElement("div", {
      style: {
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        padding: "20px 20px 28px",
        display: "flex", justifyContent: "center", gap: "16px", alignItems: "center",
        background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)",
        zIndex: 2
      },
      onClick: function(e) { e.stopPropagation(); }
    },
      React.createElement("button", {
        onClick: function(e) {
          e.stopPropagation();
          fetch("/api/gallery/" + current.id + "/like", { method: "POST" }).catch(function() {});
        },
        style: {
          background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)",
          border: "none", color: "white", borderRadius: "24px",
          padding: "8px 18px", fontSize: "0.85rem", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "6px"
        }
      },
        React.createElement("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "white" },
          React.createElement("path", { d: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" })
        ),
        "Curtir"
      ),
      React.createElement("button", {
        onClick: function(e) {
          e.stopPropagation();
          const url = isVideo
            ? "https://drive.google.com/file/d/" + current.id + "/view?usp=sharing"
            : driveThumb(current.id, 1200);
          if (navigator.share) {
            navigator.share({ title: "Batizado da Analu", url: url }).catch(function() {});
          } else {
            navigator.clipboard.writeText(url).then(function() { alert("Link copiado!"); }).catch(function() {});
          }
        },
        style: {
          background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)",
          border: "none", color: "white", borderRadius: "24px",
          padding: "8px 18px", fontSize: "0.85rem", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "6px"
        }
      },
        React.createElement("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "white", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("circle", { cx: "18", cy: "5", r: "3" }),
          React.createElement("circle", { cx: "6", cy: "12", r: "3" }),
          React.createElement("circle", { cx: "18", cy: "19", r: "3" }),
          React.createElement("line", { x1: "8.59", y1: "13.51", x2: "15.42", y2: "17.49" }),
          React.createElement("line", { x1: "15.41", y1: "6.51", x2: "8.59", y2: "10.49" })
        ),
        "Compartilhar"
      )
    )
  );

  // USA PORTAL para renderizar fora do stacking context do invitation-card
  // (backdrop-filter do card prende position:fixed dentro do seu proprio context)
  return ReactDOM.createPortal(overlay, document.body);
}

export default function Gallery() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { photos, index }

  useEffect(function() { fetchGallery(); }, []);

  async function fetchGallery() {
    try {
      const res = await fetch("/api/gallery");
      if (!res.ok) throw new Error("Erro ao carregar.");
      setPhotos(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  // Agrupa por uploader mantendo ordem de primeiro envio
  const grouped = [];
  const seen = {};
  photos.forEach(function(p) {
    const key = (p.uploaderName || "").trim();
    if (!seen[key]) { seen[key] = []; grouped.push({ uploader: key, items: seen[key] }); }
    seen[key].push(p);
  });

  if (photos.length === 0 && !loading) return null;

  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "section", style: { marginTop: "24px" } },
      React.createElement("h2", { className: "section-title" }, "Galeria de Fotos"),
      React.createElement("p", { className: "section-subtitle" }, "Momentos eternizados"),

      loading
        ? React.createElement("p", { style: { textAlign: "center", color: "var(--sage-deep)" } }, "Carregando...")
        : error
          ? React.createElement("p", { style: { textAlign: "center", color: "red" } }, error)
          : React.createElement("div", { style: { marginTop: "20px" } },
              grouped.map(function(g) {
                return React.createElement(UploaderCarousel, {
                  key: g.uploader,
                  uploader: g.uploader,
                  photos: g.items,
                  onOpenLightbox: function(photoList, idx) { setLightbox({ photos: photoList, index: idx }); }
                });
              })
            )
    ),

    lightbox && React.createElement(Lightbox, {
      photos: lightbox.photos,
      startIndex: lightbox.index,
      onClose: function() { setLightbox(null); }
    })
  );
}
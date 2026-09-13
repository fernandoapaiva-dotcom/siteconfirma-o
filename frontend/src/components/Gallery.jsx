import { Fragment, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import ZoomableImage from "./ZoomableImage.jsx";

function driveThumb(fileId, size) {
  return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w" + (size || 400);
}

function guessExtension(mimeType) {
  if (!mimeType) return "jpg";
  const sub = mimeType.split("/")[1] || "jpg";
  return sub.split(";")[0];
}

/**
 * Baixa a mídia de verdade (não um link) e abre o menu nativo de compartilhar
 * do celular com o arquivo já anexado — assim dá pra mandar direto pro
 * WhatsApp/Instagram sem passar pelo Google Drive. Se o navegador não suportar
 * compartilhar arquivos (a maioria dos desktops), cai para baixar o(s)
 * arquivo(s) direto.
 */
async function shareItems(items, { onStatus } = {}) {
  try {
    if (onStatus) onStatus(items.length > 1 ? `Preparando ${items.length} arquivos...` : "Preparando arquivo...");

    const files = await Promise.all(
      items.map(async (item) => {
        const res = await fetch("/api/download/" + item.id);
        if (!res.ok) throw new Error("Falha ao baixar " + item.id);
        const blob = await res.blob();
        const isVideo = item.mimeType && item.mimeType.startsWith("video");
        const ext = guessExtension(blob.type || item.mimeType);
        const name = `batizado-analu-${(item.uploaderName || "convidado").trim().replace(/\s+/g, "-")}-${item.id}.${ext}`;
        return new File([blob], name, { type: blob.type || item.mimeType || (isVideo ? "video/mp4" : "image/jpeg") });
      })
    );

    if (navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({ files, title: "Batizado da Analu" });
      return;
    }

    if (navigator.share) {
      // Navegador tem Web Share mas não pra arquivos — manda o link como plano B.
      await navigator.share({ title: "Batizado da Analu", url: items[0].fileUrl });
      return;
    }

    // Desktop sem Web Share: baixa o(s) arquivo(s) direto pro computador.
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("[Gallery] Erro ao compartilhar:", err);
      alert("Não foi possível compartilhar agora. Tente novamente.");
    }
  } finally {
    if (onStatus) onStatus(null);
  }
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
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Uma "playlist" vertical estilo YouTube: lista rolável de miniaturas com
 * nome de quem enviou, usada tanto pra Vídeos quanto pra Fotos — cada uma
 * na sua própria lista em vez de misturadas numa faixa só.
 */
function PlaylistList({ icon, title, kind, rowItems, items, current, selectMode, selectedIds, onPick }) {
  return (
    <div className={`carousel-playlist carousel-playlist--${kind}`}>
      <div className="carousel-playlist-title">
        <span className="carousel-playlist-icon">{icon}</span>
        {title}
        <span className="carousel-playlist-count">{rowItems.length}</span>
      </div>
      <div className="carousel-playlist-rows">
        {rowItems.map((p, i) => {
          const idx = items.indexOf(p);
          const isVid = p.mimeType && p.mimeType.startsWith("video");
          const picked = selectMode && selectedIds.has(p.id);
          return (
            <div
              key={p.id}
              data-idx={idx}
              onClick={(e) => { e.stopPropagation(); onPick(idx, p.id); }}
              className={`carousel-playlist-row ${idx === current ? "active" : ""} ${picked ? "picked" : ""}`}
            >
              <div className="carousel-playlist-thumb">
                <img src={driveThumb(p.id, 120)} alt="" loading="lazy" />
                {isVid && <div className="carousel-thumb-play"><PlayIcon size={14} /></div>}
                {selectMode && (
                  <div className={`carousel-thumb-check ${picked ? "checked" : ""}`}>
                    {picked && <CheckIcon />}
                  </div>
                )}
              </div>
              <span className="carousel-playlist-label">{isVid ? "Vídeo" : "Foto"} {i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Carrossel de mídia de um único convidado, já filtrado por tipo (fotos OU vídeos).
 * Troca de slide com um fade suave em vez de um corte seco.
 */
function MediaCarousel({ uploader, photos, videos, onOpenLightbox }) {
  const items = [...photos, ...videos];
  const [current, setCurrent] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [shareStatus, setShareStatus] = useState(null);
  const playlistsRef = useRef(null);

  // Se o conjunto de mídias mudar (ex: mais uma chegou), volta pro início.
  const itemsKey = items.map((it) => it.id).join(",");
  useEffect(() => {
    setCurrent(0);
    setSelectMode(false);
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const goTo = (idx) => {
    setCurrent(idx);
    if (playlistsRef.current) {
      const row = playlistsRef.current.querySelector(`[data-idx="${idx}"]`);
      if (row) row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const prev = (e) => { e.stopPropagation(); goTo((current - 1 + items.length) % items.length); };
  const next = (e) => { e.stopPropagation(); goTo((current + 1) % items.length); };

  const item = items[current];
  if (!item) return null;
  const isVideo = item.mimeType && item.mimeType.startsWith("video");

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleShareCurrent = (e) => {
    e.stopPropagation();
    shareItems([item], { onStatus: setShareStatus });
  };

  const handleShareSelected = (e) => {
    e.stopPropagation();
    const chosen = items.filter((it) => selectedIds.has(it.id));
    if (chosen.length === 0) return;
    shareItems(chosen, { onStatus: setShareStatus }).then(() => exitSelectMode());
  };

  return (
    <>
      <div className="carousel-body">
        <div className="carousel-stage" onClick={() => onOpenLightbox(items, current)}>
          {isVideo ? (
            <div key={item.id} className="carousel-media-enter" style={{ position: "absolute", inset: 0 }}>
              <img
                src={driveThumb(item.id, 800)}
                alt={"Vídeo de " + uploader}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={(e) => { e.target.style.opacity = "0.2"; }}
              />
              <div className="carousel-play-badge"><PlayIcon /></div>
            </div>
          ) : (
            <img
              key={item.id}
              className="carousel-media-enter"
              src={driveThumb(item.id, 800)}
              alt={"Foto de " + uploader}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { e.target.style.opacity = "0.2"; }}
            />
          )}

          {items.length > 1 && (
            <div className="carousel-counter">{current + 1} / {items.length}</div>
          )}

          {items.length > 1 && (
            <>
              <button className="carousel-nav carousel-nav-prev" onClick={prev} aria-label="Anterior">&lsaquo;</button>
              <button className="carousel-nav carousel-nav-next" onClick={next} aria-label="Próxima">&rsaquo;</button>
            </>
          )}
        </div>

        {items.length > 1 && (
          <div ref={playlistsRef} className="carousel-lists-wrap">
            {videos.length > 0 && (
              <div className="carousel-videos-col">
                <PlaylistList
                  icon={<VideoIcon />}
                  title="Vídeos"
                  kind="video"
                  rowItems={videos}
                  items={items}
                  current={current}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onPick={(idx, id) => { if (selectMode) toggleSelected(id); else goTo(idx); }}
                />
              </div>
            )}
            {photos.length > 0 && (
              <div className="carousel-photos-row">
                <PlaylistList
                  icon={<CameraIcon />}
                  title="Fotos"
                  kind="photo"
                  rowItems={photos}
                  items={items}
                  current={current}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onPick={(idx, id) => { if (selectMode) toggleSelected(id); else goTo(idx); }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="carousel-footer">
        {selectMode ? (
          <>
            <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--ink)" }}>
              {selectedIds.size === 0
                ? "Toque nas mídias que quer enviar"
                : `${selectedIds.size} selecionada${selectedIds.size > 1 ? "s" : ""}`}
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={(e) => { e.stopPropagation(); exitSelectMode(); }} className="carousel-share-btn">
                Cancelar
              </button>
              <button
                onClick={handleShareSelected}
                disabled={selectedIds.size === 0 || !!shareStatus}
                className="carousel-share-btn carousel-share-btn-primary"
              >
                <ShareIcon />
                {shareStatus || `Enviar (${selectedIds.size})`}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#888", fontSize: "0.9rem" }}>
              <HeartIcon color="#888" />
              <span>{item.likes || 0}</span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {items.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); setSelectMode(true); }} className="carousel-share-btn">
                  Selecionar
                </button>
              )}
              <button onClick={handleShareCurrent} disabled={!!shareStatus} className="carousel-share-btn">
                <ShareIcon />
                {shareStatus || "Compartilhar"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/**
 * Card de um convidado: nome, contagem total e um carrossel com duas
 * playlists verticais separadas — Vídeos e Fotos, cada uma na sua lista.
 */
function UploaderCard({ uploader, photos, videos, onOpenLightbox }) {
  const total = photos.length + videos.length;

  return (
    <div className="uploader-card">
      <div className="uploader-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div className="uploader-avatar">{uploader.trim().charAt(0).toUpperCase()}</div>
          <span className="uploader-name">{uploader.trim()}</span>
        </div>
        <span className="uploader-total-badge">{total} {total === 1 ? "arquivo" : "arquivos"}</span>
      </div>

      <MediaCarousel uploader={uploader} photos={photos} videos={videos} onOpenLightbox={onOpenLightbox} />
    </div>
  );
}

/**
 * Card de destaque com as mídias marcadas pela família como "Melhores
 * Momentos" — mesmo carrossel dos convidados, mas com visual diferenciado
 * (borda dourada) e sempre no topo da galeria.
 */
function FeaturedCard({ photos, videos, onOpenLightbox }) {
  const total = photos.length + videos.length;

  if (total === 0) return null;

  return (
    <div className="featured-showcase">
      <div className="featured-showcase-header">
        <span className="featured-showcase-kicker">✨ Em destaque ✨</span>
        <h2 className="featured-showcase-title">Melhores Momentos</h2>
        <p className="featured-showcase-subtitle">
          Os cliques mais especiais do Batizado da Analu, escolhidos a dedo pela família
        </p>
        <span className="uploader-total-badge">{total} {total === 1 ? "arquivo" : "arquivos"}</span>
      </div>

      <MediaCarousel uploader="Melhores Momentos" photos={photos} videos={videos} onOpenLightbox={onOpenLightbox} />
    </div>
  );
}

function Lightbox({ items, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex || 0);
  const [shareStatus, setShareStatus] = useState(null);
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
        width: "100dvw", height: "100dvh", background: "#000", zIndex: 99999,
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
            key={current.id}
            className="lightbox-media-enter"
            style={{ width: "100dvw", height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={"https://drive.google.com/file/d/" + current.id + "/preview"}
              allow="autoplay"
              allowFullScreen
              style={{ maxWidth: "100dvw", maxHeight: "calc(100dvh - 120px)", width: "100%", height: "100%", border: "none", outline: "none", background: "#000" }}
            />
          </div>
        ) : (
          <div
            key={current.id}
            className="lightbox-media-enter"
            style={{ width: "100dvw", height: "calc(100dvh - 90px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <ZoomableImage src={driveThumb(current.id, 1600)} alt={"Foto de " + uploaderName} />
          </div>
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
            shareItems([current], { onStatus: setShareStatus });
          }}
          disabled={!!shareStatus}
          style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)", border: "none", color: "white", borderRadius: "24px", padding: "8px 18px", fontSize: "0.85rem", cursor: shareStatus ? "default" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <ShareIcon />
          {shareStatus || "Compartilhar"}
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

  // Agrupa por convidado (mantendo a ordem de primeiro envio) e já separa
  // cada grupo em fotos e vídeos.
  const grouped = [];
  const seen = {};
  photos.forEach((p) => {
    const key = (p.uploaderName || "").trim();
    if (!seen[key]) {
      seen[key] = { uploader: key, photos: [], videos: [] };
      grouped.push(seen[key]);
    }
    const isVideo = p.mimeType && p.mimeType.startsWith("video");
    (isVideo ? seen[key].videos : seen[key].photos).push(p);
  });

  const byFeaturedOrder = (a, b) => {
    const oa = a.featuredOrder ?? Infinity;
    const ob = b.featuredOrder ?? Infinity;
    if (oa !== ob) return oa - ob;
    return b.timestamp - a.timestamp;
  };
  const featured = photos.filter((p) => p.featured);
  const featuredPhotos = featured.filter((p) => !(p.mimeType && p.mimeType.startsWith("video"))).sort(byFeaturedOrder);
  const featuredVideos = featured.filter((p) => p.mimeType && p.mimeType.startsWith("video")).sort(byFeaturedOrder);

  if (photos.length === 0 && !loading) return null;

  return (
    <>
      {!loading && !error && (featuredPhotos.length + featuredVideos.length) > 0 && (
        <div style={{ marginTop: "24px" }}>
          <FeaturedCard
            photos={featuredPhotos}
            videos={featuredVideos}
            onOpenLightbox={(items, idx) => setLightbox({ items, index: idx })}
          />
        </div>
      )}

      <div className="section" style={{ marginTop: "24px" }}>
        <h2 className="section-title">Galeria de Fotos</h2>
        <p className="section-subtitle">Momentos eternizados</p>

        {loading ? (
          <p style={{ textAlign: "center", color: "var(--sage-deep)" }}>Carregando...</p>
        ) : error ? (
          <p style={{ textAlign: "center", color: "red" }}>{error}</p>
        ) : (
          <div style={{ marginTop: "20px" }}>
            {grouped.map((g) => (
              <UploaderCard
                key={g.uploader}
                uploader={g.uploader}
                photos={g.photos}
                videos={g.videos}
                onOpenLightbox={(items, idx) => setLightbox({ items, index: idx })}
              />
            ))}
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

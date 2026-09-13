import { useRef, useState } from "react";

const MAX_SCALE = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 300;

/**
 * Imagem com zoom por pinça (celular), duplo-toque/duplo-clique e roda do
 * mouse (desktop), com arraste pra navegar quando ampliada. Feito na mão em
 * vez de depender só do zoom nativo do navegador porque dentro de um overlay
 * position:fixed em tela cheia o pinch-zoom nativo costuma se comportar de
 * forma estranha (o conteúdo "pula" ao aplicar o zoom).
 */
export default function ZoomableImage({ src, alt, onTap, containerStyle, imgStyle }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const stateRef = useRef({
    lastTapTime: 0,
    pinchStartDist: null,
    pinchStartScale: 1,
    dragging: false,
    dragStart: null,
    startPos: { x: 0, y: 0 },
    moved: false,
  });

  const clamp = (next, s) => {
    const bound = 140 * (s - 1) + 40;
    return {
      x: Math.max(-bound, Math.min(bound, next.x)),
      y: Math.max(-bound, Math.min(bound, next.y)),
    };
  };

  const resetZoom = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  const zoomAt = (nextScale) => {
    if (nextScale <= 1.02) {
      resetZoom();
    } else {
      setScale(Math.min(MAX_SCALE, nextScale));
    }
  };

  const handleTouchStart = (e) => {
    const st = stateRef.current;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      st.pinchStartDist = Math.hypot(dx, dy);
      st.pinchStartScale = scale;
    } else if (e.touches.length === 1) {
      st.moved = false;
      st.dragging = true;
      st.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      st.startPos = pos;
    }
  };

  const handleTouchMove = (e) => {
    const st = stateRef.current;
    if (e.touches.length === 2 && st.pinchStartDist) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      setScale(Math.min(MAX_SCALE, Math.max(1, st.pinchStartScale * (dist / st.pinchStartDist))));
      st.moved = true;
    } else if (e.touches.length === 1 && st.dragging && scale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - st.dragStart.x;
      const dy = e.touches[0].clientY - st.dragStart.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) st.moved = true;
      setPos(clamp({ x: st.startPos.x + dx, y: st.startPos.y + dy }, scale));
    }
  };

  const handleTouchEnd = (e) => {
    const st = stateRef.current;
    if (e.touches.length < 2) st.pinchStartDist = null;
    if (e.touches.length === 0) {
      st.dragging = false;
      if (scale < 1.05) resetZoom();
      if (!st.moved) {
        const now = Date.now();
        if (now - st.lastTapTime < DOUBLE_TAP_MS) {
          zoomAt(scale > 1 ? 1 : DOUBLE_TAP_ZOOM);
          st.lastTapTime = 0;
        } else {
          st.lastTapTime = now;
          if (onTap) onTap();
        }
      }
    }
  };

  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    const st = stateRef.current;
    st.dragging = true;
    st.dragStart = { x: e.clientX, y: e.clientY };
    st.startPos = pos;
  };

  const handleMouseMove = (e) => {
    const st = stateRef.current;
    if (!st.dragging || scale <= 1) return;
    const dx = e.clientX - st.dragStart.x;
    const dy = e.clientY - st.dragStart.y;
    setPos(clamp({ x: st.startPos.x + dx, y: st.startPos.y + dy }, scale));
  };

  const handleMouseUp = () => {
    stateRef.current.dragging = false;
  };

  const handleDoubleClick = () => {
    zoomAt(scale > 1 ? 1 : DOUBLE_TAP_ZOOM);
  };

  const handleWheel = (e) => {
    if (Math.abs(e.deltaY) < 1) return;
    e.preventDefault();
    e.stopPropagation();
    zoomAt(Math.max(1, scale - e.deltaY * 0.012));
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        touchAction: scale > 1 ? "none" : "pan-y",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...containerStyle,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          width: "auto",
          height: "auto",
          objectFit: "contain",
          display: "block",
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transition: stateRef.current.dragging || stateRef.current.pinchStartDist ? "none" : "transform 0.2s ease",
          cursor: scale > 1 ? "grab" : "zoom-in",
          userSelect: "none",
          ...imgStyle,
        }}
      />
    </div>
  );
}

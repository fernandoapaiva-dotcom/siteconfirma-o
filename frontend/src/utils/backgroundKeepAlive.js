/**
 * BackgroundKeepAlive
 * 
 * Mantém a execução do JavaScript e transferências de rede ativas mesmo quando:
 * 1. O usuário minimiza o navegador e abre o Instagram, WhatsApp, etc.
 * 2. O usuário bloqueia a tela do celular e coloca o aparelho no bolso.
 * 
 * Mecanismos combinados:
 * - HTML5 Silent Audio Media Session (Classifica a aba como player de mídia ativo no iOS e Android)
 * - MediaSession API (playbackState = "playing")
 * - Screen WakeLock API (mantém tela ligada enquanto o app estiver no foco)
 * - Auto-recovery no evento 'visibilitychange'
 */

const SILENT_WAV_BASE64 =
  "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

class BackgroundKeepAlive {
  constructor() {
    this.audioEl = null;
    this.wakeLockSentinel = null;
    this.audioContext = null;
    this.isActive = false;
    this.handleVisibility = this.handleVisibility.bind(this);
  }

  /**
   * Inicia o modo segundo plano. DEVE ser chamado dentro de um evento de clique/submit do usuário.
   */
  start() {
    if (this.isActive) return;
    this.isActive = true;

    // 1. Silent Audio Element (Garante execução no iOS Safari e Android Chrome em background)
    try {
      if (!this.audioEl) {
        const audio = new Audio(SILENT_WAV_BASE64);
        audio.loop = true;
        audio.volume = 0.05; // Baixíssimo volume inaudível (evita otimização de mudo do Safari)
        audio.setAttribute("playsinline", "true");
        audio.setAttribute("webkit-playsinline", "true");
        audio.setAttribute("x-webkit-airplay", "deny");
        audio.preload = "auto";
        this.audioEl = audio;
      }
      
      const playPromise = this.audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("[BackgroundKeepAlive] Audio autoplay não permitido diretamente:", err.message);
        });
      }
    } catch (e) {
      console.warn("[BackgroundKeepAlive] Falha ao iniciar audio silencioso:", e.message);
    }

    // 2. MediaSession API (Informa ao SO que há reprodução contínua em segundo plano)
    try {
      if (typeof navigator !== "undefined" && "mediaSession" in navigator && typeof MediaMetadata !== "undefined") {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Enviando fotos e vídeos...",
          artist: "Batizado da Analu",
          album: "Envio em Segundo Plano Ativo",
        });
        navigator.mediaSession.playbackState = "playing";
      }
    } catch (e) {
      // Ignora navegadores sem suporte
    }

    // 3. Web Audio API (Segundo canal de áudio para reforço)
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        if (this.audioContext.state === "suspended") {
          this.audioContext.resume().catch(() => {});
        }
      }
    } catch (e) {}

    // 4. Screen Wake Lock
    this.requestWakeLock();
    document.addEventListener("visibilitychange", this.handleVisibility);
    window.addEventListener("focus", this.handleVisibility);
  }

  async requestWakeLock() {
    if (!this.isActive || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      if (!this.wakeLockSentinel || this.wakeLockSentinel.released) {
        this.wakeLockSentinel = await navigator.wakeLock.request("screen");
        this.wakeLockSentinel.addEventListener("release", () => {
          this.wakeLockSentinel = null;
        });
      }
    } catch (e) {}
  }

  handleVisibility() {
    if (!this.isActive) return;

    if (document.visibilityState === "visible") {
      this.requestWakeLock();
      // Se o áudio foi pausado pelo SO durante background extremo, retoma
      if (this.audioEl && this.audioEl.paused) {
        this.audioEl.play().catch(() => {});
      }
      if (this.audioContext && this.audioContext.state === "suspended") {
        this.audioContext.resume().catch(() => {});
      }
    }
  }

  stop() {
    this.isActive = false;
    document.removeEventListener("visibilitychange", this.handleVisibility);
    window.removeEventListener("focus", this.handleVisibility);

    // Para áudio silencioso
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
      } catch (e) {}
      this.audioEl = null;
    }

    // Libera MediaSession
    try {
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "none";
      }
    } catch (e) {}

    // Fecha Web Audio
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }

    // Libera Wake Lock
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
      } catch (e) {}
      this.wakeLockSentinel = null;
    }
  }
}

export const backgroundKeepAlive = new BackgroundKeepAlive();

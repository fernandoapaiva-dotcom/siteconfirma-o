/**
 * BackgroundKeepAlive
 * 
 * Mantém a execução do JavaScript e transferências de rede ativas mesmo quando:
 * 1. O usuário minimiza o navegador e abre o Instagram, WhatsApp, etc.
 * 2. O usuário bloqueia a tela do celular ou desliga a tela física.
 * 
 * Mecanismos:
 * - HTML5 Audio Element anexado ao DOM apontando para stream HTTP real (/audio/silent.mp3)
 * - Volume ativo não-silenciado pelo SO (o arquivo contém apenas amostras de amplitude 0 = silêncio absoluto)
 * - MediaSession API com action handlers ativos
 * - Screen WakeLock API contínuo
 * - Retomada imediata em visibilitychange/pageshow/focus
 */

const FALLBACK_SILENT_WAV =
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
    if (this.isActive && this.audioEl && !this.audioEl.paused) return;
    this.isActive = true;

    // 1. HTML5 Audio anexado ao DOM físico (obrigatório no WebKit/Safari para não ser descartado)
    try {
      if (!this.audioEl) {
        let audio = document.getElementById("analu-bg-audio");
        if (!audio) {
          audio = document.createElement("audio");
          audio.id = "analu-bg-audio";
          audio.setAttribute("playsinline", "true");
          audio.setAttribute("webkit-playsinline", "true");
          audio.setAttribute("x-webkit-airplay", "deny");
          audio.style.position = "fixed";
          audio.style.opacity = "0.001";
          audio.style.pointerEvents = "none";
          audio.style.width = "1px";
          audio.style.height = "1px";
          audio.style.bottom = "0";
          audio.loop = true;
          // Faixa de 30s (em vez de uma antiga de ~0.3s) — um loop reiniciando
          // 3x por segundo tende a não ser reconhecido pelo Android/Chrome como
          // reprodução contínua de verdade, o que derruba a permissão de segundo
          // plano bem mais rápido do que uma faixa longa reiniciando raramente.
          audio.src = "/audio/silent.wav";
          document.body.appendChild(audio);
        }
        this.audioEl = audio;
      }

      // Volume 1.0 (o MP3 é matematicamente silencioso, mas impede que o SO marque como "muted" e corte a rede)
      this.audioEl.volume = 1.0;
      this.audioEl.muted = false;

      const playPromise = this.audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("[BackgroundKeepAlive] Fallback para áudio gerado:", err.message);
          if (this.audioEl) {
            this.audioEl.src = FALLBACK_SILENT_WAV;
            this.audioEl.play().catch(() => {});
          }
        });
      }
    } catch (e) {
      console.warn("[BackgroundKeepAlive] Erro ao instanciar elemento de áudio:", e.message);
    }

    // 2. MediaSession API (Sinaliza para o iOS e Android que há reprodução em andamento no lockscreen)
    try {
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        if (typeof MediaMetadata !== "undefined") {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: "Enviando mídias...",
            artist: "Batizado da Analu",
            album: "Upload em Segundo Plano",
          });
        }
        navigator.mediaSession.playbackState = "playing";

        // Handlers para que o SO mantenha a thread de áudio e rede ativa
        navigator.mediaSession.setActionHandler("play", () => {
          if (this.audioEl) this.audioEl.play().catch(() => {});
          navigator.mediaSession.playbackState = "playing";
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          // Mantém rodando para não abortar upload
          if (this.audioEl) this.audioEl.play().catch(() => {});
          navigator.mediaSession.playbackState = "playing";
        });
      }
    } catch (e) {}

    // 3. Web Audio Oscillator Silencioso (segundo canal de keep-alive)
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !this.audioContext) {
        this.audioContext = new AudioCtx();
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        gain.gain.value = 0.0001; // Quase zero, imperceptível
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.start();
      } else if (this.audioContext && this.audioContext.state === "suspended") {
        this.audioContext.resume().catch(() => {});
      }
    } catch (e) {}

    // 4. Wake Lock de Tela (mantém a tela ligada o máximo possível para envio rápido)
    this.requestWakeLock();

    document.addEventListener("visibilitychange", this.handleVisibility);
    window.addEventListener("pageshow", this.handleVisibility);
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
    }

    // Garante que o áudio não foi pausado pelo SO
    if (this.audioEl && this.audioEl.paused) {
      this.audioEl.play().catch(() => {});
    }

    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }

    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "playing";
    }
  }

  stop() {
    this.isActive = false;
    document.removeEventListener("visibilitychange", this.handleVisibility);
    window.removeEventListener("pageshow", this.handleVisibility);
    window.removeEventListener("focus", this.handleVisibility);

    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
        if (this.audioEl.parentNode) {
          this.audioEl.parentNode.removeChild(this.audioEl);
        }
      } catch (e) {}
      this.audioEl = null;
    }

    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "none";
      } catch (e) {}
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }

    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
      } catch (e) {}
      this.wakeLockSentinel = null;
    }
  }
}

export const backgroundKeepAlive = new BackgroundKeepAlive();

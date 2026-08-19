import {
  MUSIC_DEFS,
  SFX_DEFS,
  type MusicDefinition,
  type MusicTrack,
  type SfxEvent,
  type SfxSynth,
} from "./sfx-map";

// WHY: el audio se sintetiza con Web Audio API en lugar de cargar archivos,
// porque el repo aún no tiene assets binarios. El AudioContext se crea lazy
// (los navegadores bloquean audio hasta una interacción del usuario) y se
// resume si quedó suspendido.

const MIN_GAIN = 0.0001;

export interface AudioManagerOptions {
  muted?: boolean;
  masterVolume?: number;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted: boolean;
  private masterVolume: number;
  private currentMusic: MusicTrack | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;

  constructor(options: AudioManagerOptions = {}) {
    this.muted = options.muted ?? false;
    this.masterVolume = clamp(options.masterVolume ?? 1, 0, 1);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) {
      this.master.gain.value = muted ? 0 : this.masterVolume;
    }
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = clamp(volume, 0, 1);
    if (this.master && !this.muted) {
      this.master.gain.value = this.masterVolume;
    }
  }

  playSfx(event: SfxEvent): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    this.playSynth(ctx, SFX_DEFS[event].synth);
  }

  playMusic(track: MusicTrack): void {
    if (this.currentMusic === track) return;
    this.stopMusic();
    this.currentMusic = track;
    if (this.muted) return;

    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;

    const def = MUSIC_DEFS[track];
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = def.volume;
    this.musicGain.connect(this.master);

    this.musicStep = 0;
    const beatMs = 60_000 / def.bpm;
    this.scheduleMusicBeat(def, beatMs);
    this.musicTimer = setInterval(
      () => this.scheduleMusicBeat(def, beatMs),
      beatMs,
    );
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicGain?.disconnect();
    this.musicGain = null;
    this.currentMusic = null;
  }

  dispose(): void {
    this.stopMusic();
    if (this.ctx) {
      // WHY: close() devuelve Promise; no bloqueamos el dispose esperándola.
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
      this.master = null;
      this.noiseBuffer = null;
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof AudioContext === "undefined") return null;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.masterVolume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private scheduleMusicBeat(def: MusicDefinition, beatMs: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;

    const freq = def.steps[this.musicStep % def.steps.length];
    this.musicStep += 1;

    if (freq > 0) {
      this.playTone(
        ctx,
        this.musicGain,
        freq,
        freq,
        (beatMs * 0.9) / 1000,
        def.wave,
        0.18,
      );
    }
    this.playTone(
      ctx,
      this.musicGain,
      def.bassFreq,
      def.bassFreq,
      (beatMs * 0.5) / 1000,
      "sine",
      0.22,
    );
  }

  private playSynth(ctx: AudioContext, synth: SfxSynth): void {
    this.playTone(
      ctx,
      this.master as GainNode,
      synth.startFreq,
      synth.endFreq,
      synth.durationMs / 1000,
      synth.wave,
      synth.volume,
    );
    if (synth.noise) {
      this.playNoise(ctx, synth.durationMs / 1000, synth.volume * 0.5);
    }
  }

  private playTone(
    ctx: AudioContext,
    out: AudioNode,
    startFreq: number,
    endFreq: number,
    duration: number,
    wave: OscillatorType,
    volume: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFreq),
        ctx.currentTime + duration,
      );
    }
    // WHY: envelope exponencial para evitar clicks al inicio/fin de la nota.
    gain.gain.setValueAtTime(MIN_GAIN, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(MIN_GAIN, volume),
      ctx.currentTime + 0.01,
    );
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(out);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  private playNoise(ctx: AudioContext, duration: number, volume: number): void {
    if (!this.noiseBuffer) {
      this.noiseBuffer = createNoiseBuffer(ctx);
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(MIN_GAIN, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(MIN_GAIN, volume),
      ctx.currentTime + 0.01,
    );
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, ctx.currentTime + duration);

    src.connect(gain);
    gain.connect(this.master as GainNode);
    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + duration + 0.02);
  }
}

// WHY: buffer de ruido blanco reutilizable (500ms) en vez de crear uno por SFX.
function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 0.5);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

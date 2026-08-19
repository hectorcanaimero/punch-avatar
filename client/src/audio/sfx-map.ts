// Catálogo de audio: SFX y música. Datos puros (sin dependencia de DOM) para
// que sean testeables en Node. Cada evento lleva una receta de síntesis
// procedural porque aún no hay assets binarios en el repo; cuando existan,
// se agrega una `src` (URL) y el manager prioriza el archivo sobre la síntesis.
export type SfxEvent = "pow" | "whoosh" | "block" | "special" | "ko";

export type MusicTrack = "lobby" | "combat";

export type Wave = "sine" | "square" | "sawtooth" | "triangle";

export interface SfxSynth {
  wave: Wave;
  startFreq: number;
  endFreq: number;
  durationMs: number;
  // 0..1
  volume: number;
  noise: boolean;
}

export interface SfxDefinition {
  id: SfxEvent;
  label: string;
  synth: SfxSynth;
}

export interface MusicDefinition {
  id: MusicTrack;
  label: string;
  bpm: number;
  // Frecuencia por paso (beat); 0 = silencio. Se recorre en loop.
  steps: number[];
  wave: Wave;
  bassFreq: number;
  // 0..1
  volume: number;
}

export const SFX_EVENTS: readonly SfxEvent[] = [
  "pow",
  "whoosh",
  "block",
  "special",
  "ko",
];

export const MUSIC_TRACKS: readonly MusicTrack[] = ["lobby", "combat"];

export const SFX_DEFS: Record<SfxEvent, SfxDefinition> = {
  pow: {
    id: "pow",
    label: "¡Pow!",
    synth: {
      wave: "sine",
      startFreq: 180,
      endFreq: 50,
      durationMs: 120,
      volume: 0.9,
      noise: true,
    },
  },
  whoosh: {
    id: "whoosh",
    label: "Whoosh",
    synth: {
      wave: "triangle",
      startFreq: 420,
      endFreq: 120,
      durationMs: 200,
      volume: 0.45,
      noise: true,
    },
  },
  block: {
    id: "block",
    label: "Bloqueo",
    synth: {
      wave: "square",
      startFreq: 130,
      endFreq: 80,
      durationMs: 90,
      volume: 0.6,
      noise: true,
    },
  },
  special: {
    id: "special",
    label: "¡Especial!",
    synth: {
      wave: "sawtooth",
      startFreq: 200,
      endFreq: 820,
      durationMs: 420,
      volume: 0.75,
      noise: true,
    },
  },
  ko: {
    id: "ko",
    label: "K.O.",
    synth: {
      wave: "sawtooth",
      startFreq: 620,
      endFreq: 60,
      durationMs: 700,
      volume: 0.85,
      noise: true,
    },
  },
};

export const MUSIC_DEFS: Record<MusicTrack, MusicDefinition> = {
  lobby: {
    id: "lobby",
    label: "Lobby",
    bpm: 90,
    // A3, C#4, E4 — arpegio suave (A mayor).
    steps: [220, 0, 277.18, 0, 329.63, 0, 277.18, 0],
    wave: "triangle",
    bassFreq: 110,
    volume: 0.3,
  },
  combat: {
    id: "combat",
    label: "Combate",
    bpm: 140,
    // Frase más tensa y repetitiva (E).
    steps: [220, 220, 0, 277.18, 0, 329.63, 277.18, 246.94],
    wave: "square",
    bassFreq: 82.41,
    volume: 0.4,
  },
};

import type { AvatarStyle } from "./avatar-prompts";

export type UnlockKind = "glove_skin" | "avatar_style" | "comic_phrase";

export interface UnlockDef {
  id: string;
  kind: UnlockKind;
  label: string;
  level: number;
  // WHY: para avatar_style, `ref` matchea con AvatarStyle en avatar-prompts.ts;
  // para comic_phrase matchea con la key en comic-phrases (T-039);
  // para glove_skin es puramente cosmético client-side.
  ref?: AvatarStyle | string;
}

// Curva pensada con xpNeededForLevel(n) = 100 * n^1.5 (T-037): unlocks visibles
// cada 2-5 niveles para que el jugador vea recompensa frecuente sin saturar.
// Nada acá afecta balance de combate (PRD §4).
export const UNLOCKS: readonly UnlockDef[] = [
  // Starter set — level 1 (siempre desbloqueado en perfil nuevo)
  { id: "gloves_red", kind: "glove_skin", label: "Guantes Rojos", level: 1 },
  {
    id: "style_pixar_3d",
    kind: "avatar_style",
    label: "Pixar 3D",
    level: 1,
    ref: "pixar_3d",
  },
  { id: "phrase_pow", kind: "comic_phrase", label: "POW!", level: 1, ref: "pow" },
  { id: "phrase_bonk", kind: "comic_phrase", label: "BONK!", level: 1, ref: "bonk" },

  // Level 2
  { id: "phrase_zas", kind: "comic_phrase", label: "ZAS!", level: 2, ref: "zas" },

  // Level 3
  { id: "gloves_blue", kind: "glove_skin", label: "Guantes Azules", level: 3 },
  {
    id: "phrase_cataplum",
    kind: "comic_phrase",
    label: "CATAPLUM!",
    level: 3,
    ref: "cataplum",
  },

  // Level 5
  {
    id: "style_anime_shonen",
    kind: "avatar_style",
    label: "Anime Shōnen",
    level: 5,
    ref: "anime_shonen",
  },
  {
    id: "phrase_madre",
    kind: "comic_phrase",
    label: "¡MADRE!",
    level: 5,
    ref: "madre",
  },

  // Level 7
  { id: "gloves_gold", kind: "glove_skin", label: "Guantes Dorados", level: 7 },
  { id: "phrase_ay", kind: "comic_phrase", label: "¡AY!", level: 7, ref: "ay" },

  // Level 10 — hito
  {
    id: "style_comic_retro",
    kind: "avatar_style",
    label: "Cómic Retro",
    level: 10,
    ref: "comic_retro",
  },
  {
    id: "gloves_flame",
    kind: "glove_skin",
    label: "Guantes Flama",
    level: 10,
  },
  {
    id: "phrase_toma",
    kind: "comic_phrase",
    label: "¡TOMA!",
    level: 10,
    ref: "toma",
  },

  // Level 15
  {
    id: "style_chibi",
    kind: "avatar_style",
    label: "Chibi",
    level: 15,
    ref: "chibi",
  },
  { id: "phrase_uy", kind: "comic_phrase", label: "¡UY!", level: 15, ref: "uy" },

  // Level 20 — hito
  {
    id: "style_pixel_16bit",
    kind: "avatar_style",
    label: "Pixel Art 16-bit",
    level: 20,
    ref: "pixel_16bit",
  },
  {
    id: "gloves_champion",
    kind: "glove_skin",
    label: "Guantes de Campeón",
    level: 20,
  },
  {
    id: "phrase_boom",
    kind: "comic_phrase",
    label: "¡BOOM!",
    level: 20,
    ref: "boom",
  },

  // Level 25 — endgame reward
  {
    id: "gloves_dumb_legend",
    kind: "glove_skin",
    label: "Guantes Leyenda Tonta",
    level: 25,
  },
  {
    id: "phrase_leyenda",
    kind: "comic_phrase",
    label: "¡LEYENDA!",
    level: 25,
    ref: "leyenda",
  },
];

// Índice para lookup O(1) por id.
const UNLOCKS_BY_ID = new Map<string, UnlockDef>(UNLOCKS.map((u) => [u.id, u]));

export function findUnlock(id: string): UnlockDef | undefined {
  return UNLOCKS_BY_ID.get(id);
}

/**
 * Unlocks otorgados exactamente al alcanzar el nivel N (útil para postmatch hook
 * que notifica "acabás de desbloquear X").
 */
export function unlocksAtLevel(level: number): readonly UnlockDef[] {
  return UNLOCKS.filter((u) => u.level === level);
}

/**
 * Todos los unlocks accesibles con nivel <= N (útil para render de pantalla
 * de perfil: qué tiene disponible el jugador).
 */
export function unlocksAvailableAtLevel(level: number): readonly UnlockDef[] {
  return UNLOCKS.filter((u) => u.level <= level);
}

/**
 * Set default para un perfil nuevo (level 1). Usado por register_profile
 * para prellenar profile.unlocks[].
 */
export function defaultUnlockIds(): string[] {
  return unlocksAtLevel(1).map((u) => u.id);
}

/**
 * Filtra por kind. Sirve para UI: "mostrar solo las frases desbloqueadas".
 */
export function unlocksByKind(kind: UnlockKind): readonly UnlockDef[] {
  return UNLOCKS.filter((u) => u.kind === kind);
}

export interface ComicPhrase {
  key: string;
  text: string;
  unlockLevel: number;
}

// Las keys coinciden con UnlockDef.ref en unlocks.ts para que perfil y combate
// compartan una referencia estable sin acoplarse al texto visible.
export const COMIC_PHRASES: readonly ComicPhrase[] = [
  { key: "pow", text: "POW!", unlockLevel: 1 },
  { key: "bonk", text: "BONK!", unlockLevel: 1 },
  { key: "zas", text: "ZAS!", unlockLevel: 2 },
  { key: "cataplum", text: "CATAPLUM!", unlockLevel: 3 },
  { key: "madre", text: "¡MADRE!", unlockLevel: 5 },
  { key: "ay", text: "¡AY!", unlockLevel: 7 },
  { key: "toma", text: "¡TOMA!", unlockLevel: 10 },
  { key: "uy", text: "¡UY!", unlockLevel: 15 },
  { key: "boom", text: "¡BOOM!", unlockLevel: 20 },
  { key: "leyenda", text: "¡LEYENDA!", unlockLevel: 25 },
];

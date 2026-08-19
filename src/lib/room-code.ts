export const ROOM_CODE_LENGTH = 6;

// WHY: excluye 0/O y 1/I para que el código sea legible al dictarlo por voz o
// teclearlo. 32 caracteres → 32^6 ≈ 1.07B combinaciones, colisión despreciable.
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

export type Rng = () => number;

export function generateRoomCode(rng: Rng = Math.random): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const idx = Math.floor(rng() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[idx];
  }
  return code;
}

export function isValidRoomCode(code: string): boolean {
  return typeof code === "string" && ROOM_CODE_RE.test(code);
}

export function normalizeRoomCode(input: string): string | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toUpperCase();
  return isValidRoomCode(normalized) ? normalized : null;
}

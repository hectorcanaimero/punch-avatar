// Lógica pura de la escalera de rivales (T-036). Separada de CareerLadder.tsx
// para que sea importable y testeable con node --test (los .tsx con JSX no
// los resuelve el runtime de Node sin un bundler de test).

export type RivalLadderState = "beaten" | "current" | "locked";

export function normalizeCareerProgress(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  return 0;
}

export function classifyRival(
  index: number,
  careerProgress: number
): RivalLadderState {
  const idx = Number.isFinite(index) ? Math.floor(index) : 0;
  const progress = normalizeCareerProgress(careerProgress);
  if (idx < progress) return "beaten";
  if (idx === progress) return "current";
  return "locked";
}

export function isCareerCompleted(
  careerProgress: number,
  totalRivals: number
): boolean {
  const progress = normalizeCareerProgress(careerProgress);
  const total =
    Number.isFinite(totalRivals) && totalRivals > 0 ? Math.floor(totalRivals) : 0;
  return total > 0 && progress >= total;
}

export interface CareerRivalView {
  index: number;
  name: string;
  portraitUrl: string;
  health: number;
}

export interface CareerStartResponse {
  matchId: string;
  rival: CareerRivalView;
  careerProgress: number;
  totalRivals: number;
}

// WHY: parse defensivo del response de start_career_match (T-034). El RPC
// devuelve JSON.stringify({...}) y Nakama puede entregarlo como string o
// como objeto ya parseado según el cliente.
export function parseCareerStartResponse(payload: unknown): CareerStartResponse {
  let parsed: unknown = payload;
  if (typeof payload === "string") {
    try {
      parsed = JSON.parse(payload) as unknown;
    } catch {
      throw new Error("CAREER_RESPONSE_INVALID");
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("CAREER_RESPONSE_INVALID");
  }

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.matchId !== "string" || obj.matchId.length === 0) {
    throw new Error("CAREER_RESPONSE_INVALID");
  }

  const rivalRaw = obj.rival as Record<string, unknown> | undefined;
  const rival: CareerRivalView = {
    index:
      typeof rivalRaw?.index === "number" ? Math.floor(rivalRaw.index) : 0,
    name:
      typeof rivalRaw?.name === "string" && rivalRaw.name.length > 0
        ? rivalRaw.name
        : "Rival",
    portraitUrl:
      typeof rivalRaw?.portraitUrl === "string" ? rivalRaw.portraitUrl : "",
    health: typeof rivalRaw?.health === "number" ? rivalRaw.health : 0,
  };

  return {
    matchId: obj.matchId,
    rival,
    careerProgress: normalizeCareerProgress(obj.careerProgress),
    totalRivals: normalizeCareerProgress(obj.totalRivals),
  };
}

export function formatCareerError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("401") ||
    message.toLowerCase().includes("unauthenticated") ||
    message.includes("AUTH_REQUIRED")
  ) {
    return "Tu sesión venció o no está autenticada. Volvé a ingresar.";
  }
  if (message.includes("PROFILE_NOT_FOUND")) {
    return "No encontramos tu perfil. Volvé a registrarte para pelear.";
  }
  if (message.includes("CAREER_COMPLETED")) {
    return "¡Ya venciste a todos los rivales! Sos el campeón.";
  }
  if (message.includes("CAREER_RESPONSE_INVALID")) {
    return "El servidor devolvió una respuesta inesperada. Intentá de nuevo.";
  }
  return "No pudimos arrancar la pelea. Revisá tu conexión e intentá de nuevo.";
}

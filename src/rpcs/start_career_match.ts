import { RIVALS, type Rival } from "../data/rivals";

const PROFILES_COLLECTION = "profiles";
const PROFILE_KEY = "profile";

type ProfileShape = {
  careerProgress?: number;
  [key: string]: unknown;
};

export interface CareerRivalPick {
  rivalIndex: number;
  rival: Rival;
  careerProgress: number;
  totalRivals: number;
}

// WHY: pura y exportada — permite testear la lógica de elección de rival
// (default a 0 si el perfil no lo tiene, throw CAREER_COMPLETED al pasar de
// RIVALS.length, clamp defensivo contra negativos) sin tocar nk.
export function pickCareerRival(rawProgress: unknown): CareerRivalPick {
  const careerProgress =
    typeof rawProgress === "number" && Number.isFinite(rawProgress)
      ? Math.floor(rawProgress)
      : 0;
  if (careerProgress >= RIVALS.length) {
    throw new Error("CAREER_COMPLETED");
  }
  const rivalIndex = Math.max(0, careerProgress);
  const rival = RIVALS[rivalIndex];
  return {
    rivalIndex,
    rival,
    careerProgress,
    totalRivals: RIVALS.length,
  };
}

export const startCareerMatchRpc: nkruntime.RpcFunction = (
  ctx,
  logger,
  nk,
  _payload,
): string => {
  if (!ctx.userId) throw new Error("AUTH_REQUIRED");
  const userId = ctx.userId;

  const reads = nk.storageRead([
    { collection: PROFILES_COLLECTION, key: PROFILE_KEY, userId },
  ]);
  if (reads.length === 0) throw new Error("PROFILE_NOT_FOUND");
  const profile = reads[0].value as ProfileShape;

  const pick = pickCareerRival(profile.careerProgress);

  // WHY: match handler career (T-033) espera { mode: "career", rivalIndex } y
  // pre-inserta el bot con sessionId sintético — el cliente solo tiene que
  // matchJoin(matchId) para que ese hueco quede completo con el humano.
  const matchId = nk.matchCreate("combat", {
    mode: "career",
    rivalIndex: pick.rivalIndex,
  });

  logger.info(
    `start_career_match userId=${userId} rival[${pick.rivalIndex}]=${pick.rival.name} matchId=${matchId}`,
  );

  return JSON.stringify({
    matchId,
    rival: {
      index: pick.rivalIndex,
      name: pick.rival.name,
      portraitUrl: pick.rival.portraitUrl,
      health: pick.rival.health,
    },
    careerProgress: pick.careerProgress,
    totalRivals: pick.totalRivals,
  });
};

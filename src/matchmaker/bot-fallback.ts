import { RIVALS, type Rival } from "../data/rivals.ts";

const PROFILES_COLLECTION = "profiles";
const PROFILE_KEY = "profile";
const COMBAT_MATCH_MODULE = "combat";
const CAREER_MODE = "career";

// WHY: 10 rivales × 200 puntos ELO = span 2000. Reparte parejo sobre el rango
// jugable (bronce 0-999 → rivales 0-4, plata 1000-1399 → 5-6, oro 1400-1799 → 7-8,
// leyenda 1800+ → 9). Rank más allá del último tier satura en el rival final.
export const RANK_PER_RIVAL_STEP = 200;

export interface BotRivalSelection {
  index: number;
  rival: Rival;
}

export interface BotFallbackMatchResponse {
  matchId: string;
  rivalIndex: number;
  rivalName: string;
  mode: "career";
}

type StoredProfile = { rankScore?: unknown };

export function selectBotRivalForRank(rankScore: number): BotRivalSelection {
  const safeRank =
    Number.isFinite(rankScore) && rankScore > 0 ? Math.floor(rankScore) : 0;
  const maxIndex = RIVALS.length - 1;
  const rawIndex = Math.floor(safeRank / RANK_PER_RIVAL_STEP);
  const index = Math.max(0, Math.min(maxIndex, rawIndex));
  return { index, rival: RIVALS[index] };
}

function readAuthoritativeRank(
  nk: nkruntime.Nakama,
  userId: string,
): number {
  const objects = nk.storageRead([
    { collection: PROFILES_COLLECTION, key: PROFILE_KEY, userId },
  ]);
  if (objects.length === 0) throw new Error("PROFILE_NOT_FOUND");
  const stored = (objects[0].value as StoredProfile).rankScore;
  // WHY: perfil nuevo puede no tener rankScore aún; tratar como 0 (bronce base).
  if (stored === undefined || stored === null) return 0;
  if (typeof stored !== "number" || !Number.isFinite(stored) || stored < 0) {
    throw new Error("RANK_SCORE_INVALID");
  }
  return stored;
}

export const startBotFallbackMatchRpc: nkruntime.RpcFunction = (
  ctx,
  logger,
  nk,
  _payload,
): string => {
  if (!ctx.userId) throw new Error("AUTH_REQUIRED");

  let rankScore: number;
  try {
    rankScore = readAuthoritativeRank(nk, ctx.userId);
  } catch (err) {
    const msg = (err as Error).message ?? "";
    if (msg === "PROFILE_NOT_FOUND" || msg === "RANK_SCORE_INVALID") throw err;
    // WHY: storageRead lanza en not-found; unificamos con PROFILE_NOT_FOUND.
    logger.warn(
      `start_bot_fallback_match: rank read failed for ${ctx.userId}: ${msg}`,
    );
    throw new Error("PROFILE_NOT_FOUND");
  }

  const { index, rival } = selectBotRivalForRank(rankScore);
  const matchId = nk.matchCreate(COMBAT_MATCH_MODULE, {
    mode: CAREER_MODE,
    rivalIndex: index,
  });

  logger.info(
    `start_bot_fallback_match: user=${ctx.userId} rank=${rankScore} rival[${index}]=${rival.name} matchId=${matchId}`,
  );

  const response: BotFallbackMatchResponse = {
    matchId,
    rivalIndex: index,
    rivalName: rival.name,
    mode: "career",
  };
  return JSON.stringify(response);
};

const PROFILES_COLLECTION = "profiles";
const PROFILE_KEY = "profile";

export const RANKED_MATCH_SIZE = 2;
export const MAX_RANK_DISTANCE = 400;

type RankedProfile = { rankScore?: unknown };

export function isValidRankedPair(rankScores: readonly number[]): boolean {
  return (
    rankScores.length === RANKED_MATCH_SIZE &&
    rankScores.every((score) => Number.isFinite(score) && score >= 0) &&
    Math.abs(rankScores[0] - rankScores[1]) <= MAX_RANK_DISTANCE
  );
}

function readAuthoritativeRanks(
  nk: nkruntime.Nakama,
  matches: nkruntime.MatchmakerResult[],
): number[] {
  const objects = nk.storageRead(
    matches.map(({ presence }) => ({
      collection: PROFILES_COLLECTION,
      key: PROFILE_KEY,
      userId: presence.userId,
    })),
  );

  const ranksByUser = new Map<string, number>();
  for (const object of objects) {
    const rankScore = (object.value as RankedProfile).rankScore;
    if (typeof rankScore === "number") {
      ranksByUser.set(object.userId, rankScore);
    }
  }

  return matches.map(({ presence }) => ranksByUser.get(presence.userId) ?? NaN);
}

export const rankedMatchmakerMatched: nkruntime.MatchmakerMatchedFunction = (
  _ctx,
  logger,
  nk,
  matches,
): string => {
  const uniqueUsers = new Set(matches.map(({ presence }) => presence.userId));
  if (matches.length !== RANKED_MATCH_SIZE || uniqueUsers.size !== RANKED_MATCH_SIZE) {
    logger.warn(`ranked match rejected: expected ${RANKED_MATCH_SIZE} unique players`);
    throw new Error("RANKED_MATCH_INVALID_PLAYERS");
  }

  let rankScores: number[];
  try {
    // WHY: las properties del ticket son controladas por el cliente. El callback
    // vuelve a leer Storage para que falsificar rankScore nunca habilite un match.
    rankScores = readAuthoritativeRanks(nk, matches);
  } catch (error) {
    logger.error(`ranked match profile read failed: ${(error as Error).message}`);
    throw error;
  }

  if (!isValidRankedPair(rankScores)) {
    logger.warn("ranked match rejected: authoritative rank distance is invalid");
    throw new Error("RANKED_MATCH_INVALID_RANKS");
  }

  return nk.matchCreate("combat", { mode: "ranked" });
};

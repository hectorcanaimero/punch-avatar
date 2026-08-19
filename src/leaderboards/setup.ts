export const LEADERBOARD_MOST_KOS = "most_kos";
export const LEADERBOARD_CURRENT_STREAK = "current_streak";

interface LeaderboardSpec {
  id: string;
  sortOrder: nkruntime.SortOrder;
  operator: nkruntime.Operator;
  metadata: Record<string, unknown>;
}

const LEADERBOARDS: readonly LeaderboardSpec[] = [
  {
    id: LEADERBOARD_MOST_KOS,
    // WHY: cumulative KO count; INCR permite sumar 1 por cada KO sin R-M-W.
    sortOrder: "desc" as nkruntime.SortOrder,
    operator: "incr" as nkruntime.Operator,
    metadata: { title: "Más K.O.s", scoreLabel: "K.O.s" },
  },
  {
    id: LEADERBOARD_CURRENT_STREAK,
    // WHY: reset a 0 en derrota + set en victoria requiere SET (INCR no permite bajar).
    sortOrder: "desc" as nkruntime.SortOrder,
    operator: "set" as nkruntime.Operator,
    metadata: { title: "Racha Actual", scoreLabel: "Victorias seguidas" },
  },
];

export function registerLeaderboards(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger
): void {
  for (const spec of LEADERBOARDS) {
    try {
      nk.leaderboardCreate(
        spec.id,
        true, // authoritative — solo escritura server-side
        spec.sortOrder,
        spec.operator,
        "", // sin reset schedule (rango global permanente)
        spec.metadata
      );
      logger.info(`leaderboards: created ${spec.id}`);
    } catch (err) {
      // WHY: si ya existe, Nakama lanza; para init idempotente lo tratamos como ok.
      const msg = (err as Error).message ?? "";
      if (msg.includes("already exists") || msg.includes("Already exists")) {
        logger.info(`leaderboards: ${spec.id} already exists, skip`);
        continue;
      }
      logger.error(`leaderboards: create ${spec.id} failed: ${msg}`);
      throw err;
    }
  }
}

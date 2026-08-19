import {
  LEADERBOARD_CURRENT_STREAK,
  LEADERBOARD_MOST_KOS,
} from "../leaderboards/setup";

export interface PostmatchLeaderboardInput {
  winnerId: string | null;
  loserId: string | null;
  winnerUsername: string;
  loserUsername: string;
  // WHY: true si el ganador dejó al oponente en 0 HP (no si ganó por abandono).
  // matchTerminate (T-020) sabe la razón; el caller decide si fue KO real.
  isKo: boolean;
}

function readCurrentStreak(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  userId: string
): number {
  try {
    const list = nk.leaderboardRecordsList(
      LEADERBOARD_CURRENT_STREAK,
      [userId],
      1
    );
    const record = list.ownerRecords?.[0];
    return record ? record.score : 0;
  } catch (err) {
    logger.warn(
      `leaderboards: streak read ${userId} failed: ${(err as Error).message}`
    );
    return 0;
  }
}

export function updateLeaderboardsAfterMatch(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  input: PostmatchLeaderboardInput
): void {
  const { winnerId, loserId, winnerUsername, loserUsername, isKo } = input;

  if (winnerId) {
    if (isKo) {
      try {
        // INCR: suma 1 al total acumulado de KOs.
        nk.leaderboardRecordWrite(
          LEADERBOARD_MOST_KOS,
          winnerId,
          winnerUsername,
          1,
          0
        );
      } catch (err) {
        logger.warn(
          `leaderboards: most_kos ${winnerId} failed: ${(err as Error).message}`
        );
      }
    }

    // SET: escribe streak actual + 1 (leer-modificar-escribir por op=set).
    const nextStreak = readCurrentStreak(nk, logger, winnerId) + 1;
    try {
      nk.leaderboardRecordWrite(
        LEADERBOARD_CURRENT_STREAK,
        winnerId,
        winnerUsername,
        nextStreak,
        0
      );
    } catch (err) {
      logger.warn(
        `leaderboards: streak write ${winnerId} failed: ${(err as Error).message}`
      );
    }
  }

  if (loserId) {
    try {
      // Reset a 0 rompe la racha del que pierde.
      nk.leaderboardRecordWrite(
        LEADERBOARD_CURRENT_STREAK,
        loserId,
        loserUsername,
        0,
        0
      );
    } catch (err) {
      logger.warn(
        `leaderboards: streak reset ${loserId} failed: ${(err as Error).message}`
      );
    }
  }
}

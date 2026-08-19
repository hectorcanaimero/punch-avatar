import {
  ACHIEVEMENTS,
  type AchievementId,
} from "../data/achievements";

export const ACHIEVEMENTS_COLLECTION = "achievements";

export interface AchievementMatchResult {
  won: boolean;
  ko: boolean;
  hitsReceived: number;
  remainingHealth: number;
  mode: "career" | "friendly" | "ranked";
  careerRivalNumber?: number;
}

export interface StoredAchievement {
  id: AchievementId;
  unlockedAt: number;
}

export function eligibleAchievements(
  result: AchievementMatchResult
): AchievementId[] {
  if (!result.won) return [];

  const eligible: AchievementId[] = [];
  if (result.ko) eligible.push("first_blood");
  if (result.hitsReceived === 0) eligible.push("cara_de_piedra");
  if (result.remainingHealth < 10) eligible.push("remontada");
  if (result.mode === "career" && result.careerRivalNumber === 10) {
    eligible.push("campeon");
  }
  return eligible;
}

export function verifyAchievements(
  nk: nkruntime.Nakama,
  userId: string,
  result: AchievementMatchResult,
  unlockedAt: number = Date.now()
): AchievementId[] {
  const eligible = eligibleAchievements(result);
  if (eligible.length === 0) return [];

  let stored: nkruntime.StorageObject[];
  try {
    stored = nk.storageRead(
      ACHIEVEMENTS.map(({ id }) => ({
        collection: ACHIEVEMENTS_COLLECTION,
        key: id,
        userId,
      }))
    );
  } catch (error) {
    throw new Error(`ACHIEVEMENTS_READ_FAILED:${String(error)}`);
  }

  const unlocked = new Set(stored.map(({ key }) => key));
  const newlyUnlocked = eligible.filter((id) => !unlocked.has(id));
  if (newlyUnlocked.length === 0) return [];

  try {
    nk.storageWrite(
      newlyUnlocked.map((id) => ({
        collection: ACHIEVEMENTS_COLLECTION,
        key: id,
        userId,
        value: { id, unlockedAt } satisfies StoredAchievement,
        // WHY: create-only evita reotorgar el logro si dos hooks compiten.
        version: "*",
        permissionRead: 2,
        permissionWrite: 0,
      }))
    );
  } catch (error) {
    throw new Error(`ACHIEVEMENTS_WRITE_FAILED:${String(error)}`);
  }

  return newlyUnlocked;
}

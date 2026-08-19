import { unlocksAtLevel } from "../data/unlocks";
import { awardXp, levelFromXp, type MatchResult } from "../lib/xp";

const PROFILES_COLLECTION = "profiles";
const PROFILE_KEY = "profile";

export interface PostmatchXpInput {
  userId: string;
  result: MatchResult;
  cleanKo: boolean;
  firstCareerWin: boolean;
}

export interface PostmatchXpResult {
  userId: string;
  xpAwarded: number;
  totalXp: number;
  oldLevel: number;
  newLevel: number;
  levelUps: number;
  newUnlocks: string[];
}

type ProfileShape = {
  level?: number;
  xp?: number;
  wins?: number;
  losses?: number;
  kos?: number;
  unlocks?: string[];
  [key: string]: unknown;
};

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

// WHY: función pura sin acceso a nk. Todo el cálculo de XP + nivel + unlocks
// vive acá para que sea testable sin mocks. `applyPostmatchXp` la wrappea
// con las llamadas de storage.
export function computeProfileUpdate(
  current: ProfileShape,
  input: PostmatchXpInput,
): { updated: ProfileShape; result: PostmatchXpResult } {
  const xpAwarded = awardXp({
    result: input.result,
    cleanKo: input.cleanKo,
    firstCareerWin: input.firstCareerWin,
  });

  const currentXp = toNumber(current.xp, 0);
  const totalXp = currentXp + xpAwarded;
  const oldLevel = toNumber(current.level, 1);
  const newLevel = levelFromXp(totalXp);
  const levelUps = Math.max(0, newLevel - oldLevel);

  const currentUnlocks = Array.isArray(current.unlocks) ? current.unlocks : [];
  const unlockSet = new Set<string>(currentUnlocks);
  const newUnlocks: string[] = [];
  for (let n = oldLevel + 1; n <= newLevel; n += 1) {
    for (const unlock of unlocksAtLevel(n)) {
      if (!unlockSet.has(unlock.id)) {
        newUnlocks.push(unlock.id);
        unlockSet.add(unlock.id);
      }
    }
  }

  const updated: ProfileShape = {
    ...current,
    xp: totalXp,
    level: newLevel,
    unlocks: Array.from(unlockSet),
  };

  if (input.result === "win") {
    updated.wins = toNumber(current.wins, 0) + 1;
    // WHY: solo contamos kos cuando fue win por KO limpio; kos genéricos
    // requerirían un campo koWin explícito (no disponible hoy) — proxy
    // que undercount pero nunca overcount, aceptable para MVP.
    if (input.cleanKo) {
      updated.kos = toNumber(current.kos, 0) + 1;
    }
  } else {
    updated.losses = toNumber(current.losses, 0) + 1;
  }

  return {
    updated,
    result: {
      userId: input.userId,
      xpAwarded,
      totalXp,
      oldLevel,
      newLevel,
      levelUps,
      newUnlocks,
    },
  };
}

export function applyPostmatchXp(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  input: PostmatchXpInput,
): PostmatchXpResult {
  const reads = nk.storageRead([
    {
      collection: PROFILES_COLLECTION,
      key: PROFILE_KEY,
      userId: input.userId,
    },
  ]);
  if (reads.length === 0) {
    throw new Error(`PROFILE_NOT_FOUND:${input.userId}`);
  }
  const current = reads[0].value as ProfileShape;

  const { updated, result } = computeProfileUpdate(current, input);

  nk.storageWrite([
    {
      collection: PROFILES_COLLECTION,
      key: PROFILE_KEY,
      userId: input.userId,
      value: updated,
      permissionRead: 2,
      permissionWrite: 0,
    },
  ]);

  logger.info(
    `postmatch-xp userId=${input.userId} +${result.xpAwarded}xp level=${result.oldLevel}→${result.newLevel} unlocks=${result.newUnlocks.length}`,
  );

  return result;
}

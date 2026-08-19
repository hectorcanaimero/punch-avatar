import { RIVALS } from "../data/rivals.ts";

const PROFILES_COLLECTION = "profiles";
const PROFILE_KEY = "profile";

export interface PostmatchCareerInput {
  userId: string;
  rivalIndex: number;
  won: boolean;
}

export interface PostmatchCareerResult {
  userId: string;
  rivalIndex: number;
  won: boolean;
  wasFirstDefeat: boolean;
  careerProgressBefore: number;
  careerProgressAfter: number;
  advanced: boolean;
  isFinalChampion: boolean;
}

type ProfileShape = {
  careerProgress?: number;
  [key: string]: unknown;
};

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampRivalIndex(idx: number): number {
  if (!Number.isFinite(idx)) return 0;
  return Math.max(0, Math.min(RIVALS.length - 1, Math.floor(idx)));
}

/**
 * Función pura testable. WHY:
 * - careerProgress = índice del PRÓXIMO rival a enfrentar (0 = Tito Cucharón,
 *   ..., RIVALS.length = escalera completada).
 * - Solo avanzamos si el jugador ganó CONTRA el rival esperado (rivalIndex ===
 *   careerProgress). Ganar una revancha vs un rival ya vencido no avanza y no
 *   cuenta como "first defeat" (no debe re-otorgar el bonus firstCareerWin de
 *   +100 XP definido en xp.ts).
 * - Perder nunca cambia el progreso (PRD §2: "no penaliza progreso, permite
 *   reintento inmediato").
 */
export function computeCareerUpdate(
  current: ProfileShape,
  input: PostmatchCareerInput
): { updated: ProfileShape; result: PostmatchCareerResult } {
  const rivalIndex = clampRivalIndex(input.rivalIndex);
  const progressBefore = toNumber(current.careerProgress, 0);

  if (!input.won) {
    return {
      updated: current,
      result: {
        userId: input.userId,
        rivalIndex,
        won: false,
        wasFirstDefeat: false,
        careerProgressBefore: progressBefore,
        careerProgressAfter: progressBefore,
        advanced: false,
        isFinalChampion: false,
      },
    };
  }

  const wasFirstDefeat = rivalIndex === progressBefore;
  const progressAfter = wasFirstDefeat
    ? Math.min(RIVALS.length, progressBefore + 1)
    : progressBefore;
  const advanced = progressAfter > progressBefore;
  const isFinalChampion =
    wasFirstDefeat && rivalIndex === RIVALS.length - 1;

  const updated: ProfileShape = advanced
    ? { ...current, careerProgress: progressAfter }
    : current;

  return {
    updated,
    result: {
      userId: input.userId,
      rivalIndex,
      won: true,
      wasFirstDefeat,
      careerProgressBefore: progressBefore,
      careerProgressAfter: progressAfter,
      advanced,
      isFinalChampion,
    },
  };
}

export function applyPostmatchCareer(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  input: PostmatchCareerInput
): PostmatchCareerResult {
  const reads = nk.storageRead([
    { collection: PROFILES_COLLECTION, key: PROFILE_KEY, userId: input.userId },
  ]);
  if (reads.length === 0) {
    throw new Error(`PROFILE_NOT_FOUND:${input.userId}`);
  }
  const current = reads[0].value as ProfileShape;
  const { updated, result } = computeCareerUpdate(current, input);

  if (result.advanced) {
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
  }

  logger.info(
    `postmatch-career userId=${input.userId} rival=${result.rivalIndex} won=${result.won} advanced=${result.advanced} firstDefeat=${result.wasFirstDefeat} champion=${result.isFinalChampion}`
  );
  return result;
}

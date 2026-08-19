import { computeElo, type EloResult } from "../lib/elo.ts";

const PROFILES_COLLECTION = "profiles";
const PROFILE_KEY = "profile";
const DEFAULT_RANK_SCORE = 1000; // Spec 07 §Alcance: rankScore default 1000.

export interface PostmatchRankedInput {
  userIdA: string;
  userIdB: string;
  /** 1 = A gana, 0 = A pierde, 0.5 = empate/doble abandono. */
  resultA: EloResult;
  /**
   * K.O. limpio = ganador termina sin recibir daño (PRD §Ranked línea 210).
   * En draw se ignora. Nunca aplica en abandono (spec 07 §Aceptación: mismo
   * castigo que derrota, sin bonus para el que "ganó" por default).
   */
  cleanKo?: boolean;
  /** Override de K para balance (Spec 07 §Riesgos). */
  k?: number;
}

export interface PostmatchRankedResult {
  userIdA: string;
  userIdB: string;
  rankBeforeA: number;
  rankBeforeB: number;
  rankAfterA: number;
  rankAfterB: number;
  resultA: EloResult;
  cleanKo: boolean;
}

type ProfileShape = {
  rankScore?: unknown;
  [key: string]: unknown;
};

function readRank(profile: ProfileShape): number {
  const raw = profile.rankScore;
  if (raw === undefined || raw === null) return DEFAULT_RANK_SCORE;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
    throw new Error("RANK_SCORE_INVALID");
  }
  return raw;
}

/**
 * Función pura testable. WHY:
 * - Cliente no puede meter mano en el rank: los profiles llegan ya leídos
 *   por el wrapper desde Storage (fuente autoritativa).
 * - Si un perfil no tiene rankScore aún, arranca en 1000 (Spec 07 §Alcance),
 *   pero solo lo persistimos si de hecho cambia — evita write-amp en debut.
 * - Empate: aplicamos Elo con resultA=0.5 y bonus KO se descarta (spec no
 *   define KO en draw; sería raro además — nadie "dominó").
 */
export function computeRankedUpdate(
  profileA: ProfileShape,
  profileB: ProfileShape,
  input: PostmatchRankedInput,
): {
  updatedA: ProfileShape;
  updatedB: ProfileShape;
  result: PostmatchRankedResult;
} {
  const rankBeforeA = readRank(profileA);
  const rankBeforeB = readRank(profileB);

  const { rankA: rankAfterA, rankB: rankAfterB } = computeElo({
    rankA: rankBeforeA,
    rankB: rankBeforeB,
    resultA: input.resultA,
    cleanKo: input.cleanKo === true,
    k: input.k,
  });

  const updatedA: ProfileShape =
    rankAfterA === rankBeforeA
      ? profileA
      : { ...profileA, rankScore: rankAfterA };
  const updatedB: ProfileShape =
    rankAfterB === rankBeforeB
      ? profileB
      : { ...profileB, rankScore: rankAfterB };

  return {
    updatedA,
    updatedB,
    result: {
      userIdA: input.userIdA,
      userIdB: input.userIdB,
      rankBeforeA,
      rankBeforeB,
      rankAfterA,
      rankAfterB,
      resultA: input.resultA,
      cleanKo: input.cleanKo === true,
    },
  };
}

export function applyPostmatchRanked(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  input: PostmatchRankedInput,
): PostmatchRankedResult {
  if (!input.userIdA || !input.userIdB) throw new Error("USER_ID_REQUIRED");
  if (input.userIdA === input.userIdB) throw new Error("USER_ID_DUPLICATE");

  const reads = nk.storageRead([
    { collection: PROFILES_COLLECTION, key: PROFILE_KEY, userId: input.userIdA },
    { collection: PROFILES_COLLECTION, key: PROFILE_KEY, userId: input.userIdB },
  ]);

  // WHY: storageRead devuelve solo los presentes; mapeamos por userId para no
  // asumir orden y para detectar cuál falta si acaso.
  const byUser = new Map<string, ProfileShape>();
  for (const obj of reads) {
    byUser.set(obj.userId, obj.value as ProfileShape);
  }
  const profileA = byUser.get(input.userIdA);
  const profileB = byUser.get(input.userIdB);
  if (!profileA) throw new Error(`PROFILE_NOT_FOUND:${input.userIdA}`);
  if (!profileB) throw new Error(`PROFILE_NOT_FOUND:${input.userIdB}`);

  const { updatedA, updatedB, result } = computeRankedUpdate(
    profileA,
    profileB,
    input,
  );

  const writes: nkruntime.StorageWriteRequest[] = [];
  if (updatedA !== profileA) {
    writes.push({
      collection: PROFILES_COLLECTION,
      key: PROFILE_KEY,
      userId: input.userIdA,
      value: updatedA,
      permissionRead: 2,
      permissionWrite: 0,
    });
  }
  if (updatedB !== profileB) {
    writes.push({
      collection: PROFILES_COLLECTION,
      key: PROFILE_KEY,
      userId: input.userIdB,
      value: updatedB,
      permissionRead: 2,
      permissionWrite: 0,
    });
  }
  if (writes.length > 0) nk.storageWrite(writes);

  logger.info(
    `postmatch-ranked A=${input.userIdA} (${result.rankBeforeA}→${result.rankAfterA}) B=${input.userIdB} (${result.rankBeforeB}→${result.rankAfterB}) resultA=${result.resultA} cleanKO=${result.cleanKo}`,
  );
  return result;
}

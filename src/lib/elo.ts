// Cálculo Elo autoritativo para el modo ranked (Spec 07 §Alcance).
// TODO: si el balance con K=24 se siente flojo, exponer `k` en el hook
// postmatch en vez de hardcodearlo acá.

export const K_FACTOR = 24;
export const CLEAN_KO_BONUS = 5;
export const ELO_SCALE = 400;
export const MIN_RANK = 0;

export type EloResult = 0 | 0.5 | 1;

export interface ComputeEloInput {
  rankA: number;
  rankB: number;
  /** 1 = A gana, 0 = A pierde, 0.5 = empate. */
  resultA: EloResult;
  /** K.O. limpio (sin caídas del ganador). Suma +5 al ganador únicamente. */
  cleanKo?: boolean;
  /** Override de K para balance. Debe ser > 0. */
  k?: number;
}

export interface ComputeEloOutput {
  rankA: number;
  rankB: number;
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`ELO_${name}_INVALID`);
  }
}

function normalizeResult(result: EloResult): number {
  // WHY: guardamos contra un client-side/hook mal escrito que mande otro valor.
  if (result === 0 || result === 0.5 || result === 1) return result;
  throw new Error("ELO_RESULT_INVALID");
}

/**
 * Probabilidad esperada de que A gane contra B según la fórmula Elo clásica.
 * Devuelve un valor en (0, 1). No aplica bonus ni redondeo.
 */
export function computeExpectedScore(rankA: number, rankB: number): number {
  assertFiniteNonNegative(rankA, "RANK_A");
  assertFiniteNonNegative(rankB, "RANK_B");
  return 1 / (1 + Math.pow(10, (rankB - rankA) / ELO_SCALE));
}

/**
 * Calcula los nuevos rankScore de A y B tras una pelea ranked.
 * Contrato Spec 07:
 * - K = 24 (override permitido para balance).
 * - Elo simétrico (aprox, redondeo entero puede diferir ±1).
 * - K.O. limpio → +5 bonus SOLO al ganador (loser no recibe penalidad extra).
 * - Rank nunca baja de 0 (clamp).
 */
export function computeElo(input: ComputeEloInput): ComputeEloOutput {
  const { rankA, rankB } = input;
  assertFiniteNonNegative(rankA, "RANK_A");
  assertFiniteNonNegative(rankB, "RANK_B");

  const k = input.k ?? K_FACTOR;
  if (!Number.isFinite(k) || k <= 0) throw new Error("ELO_K_INVALID");

  const resultA = normalizeResult(input.resultA);
  const resultB = 1 - resultA;

  const expectedA = computeExpectedScore(rankA, rankB);
  const expectedB = 1 - expectedA;

  let deltaA = k * (resultA - expectedA);
  let deltaB = k * (resultB - expectedB);

  // WHY: bonus va al ganador tal como lo describe la Spec 07 ("+5 bonus
  // rankScore"). En empate no aplica; si alguien pasa cleanKo=true con
  // resultA=0.5 lo ignoramos silenciosamente para no ensuciar la simetría.
  if (input.cleanKo && resultA !== 0.5) {
    if (resultA === 1) deltaA += CLEAN_KO_BONUS;
    else deltaB += CLEAN_KO_BONUS;
  }

  return {
    rankA: Math.max(MIN_RANK, Math.round(rankA + deltaA)),
    rankB: Math.max(MIN_RANK, Math.round(rankB + deltaB)),
  };
}

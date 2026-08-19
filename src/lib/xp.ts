import { XP_BALANCE } from "../config/xp";

export type MatchResult = "win" | "loss";

export interface XpMatch {
  result: MatchResult;
  cleanKo: boolean;
  firstCareerWin: boolean;
}

export function awardXp(match: XpMatch): number {
  let xp = match.result === "win" ? XP_BALANCE.victory : XP_BALANCE.defeat;
  if (match.cleanKo) xp += XP_BALANCE.cleanKoBonus;
  if (match.firstCareerWin) xp += XP_BALANCE.firstCareerWinBonus;
  return xp;
}

// WHY: xpNeededForLevel(n) es el XP requerido para avanzar del nivel n al n+1
// (no el total acumulado), así levelFromXp es su inversa limpia: nivel 1 = 0 XP.
export function xpNeededForLevel(level: number): number {
  if (level < 1) return 0;
  return Math.floor(
    XP_BALANCE.levelCurveBase * Math.pow(level, XP_BALANCE.levelCurveExponent)
  );
}

export function levelFromXp(xp: number): number {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  while (remaining >= xpNeededForLevel(level)) {
    remaining -= xpNeededForLevel(level);
    level += 1;
  }
  return level;
}

export const RANK_TIERS = [
  "Bronce",
  "Plata",
  "Oro",
  "Leyenda Tonta",
] as const;

export type RankTier = (typeof RANK_TIERS)[number];

export function tierFromScore(rankScore: number): RankTier {
  const score = Number.isFinite(rankScore) ? Math.max(0, rankScore) : 0;

  if (score >= 1800) return "Leyenda Tonta";
  if (score >= 1400) return "Oro";
  if (score >= 1000) return "Plata";
  return "Bronce";
}

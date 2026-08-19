import type { CSSProperties } from "react";

import { tierFromScore, type RankTier } from "../../../src/lib/tier";

export interface TierBadgeProps {
  rankScore: number;
  showScore?: boolean;
}

const TIER_COLORS: Readonly<Record<RankTier, CSSProperties>> = {
  Bronce: {
    backgroundColor: "#5c3219",
    borderColor: "#cd7f32",
    color: "#fff4e6",
  },
  Plata: {
    backgroundColor: "#334155",
    borderColor: "#cbd5e1",
    color: "#f8fafc",
  },
  Oro: {
    backgroundColor: "#713f12",
    borderColor: "#facc15",
    color: "#fefce8",
  },
  "Leyenda Tonta": {
    backgroundColor: "#581c87",
    borderColor: "#d8b4fe",
    color: "#faf5ff",
  },
};

export function TierBadge({ rankScore, showScore = false }: TierBadgeProps) {
  const tier = tierFromScore(rankScore);
  const safeScore = Number.isFinite(rankScore)
    ? Math.max(0, Math.floor(rankScore))
    : 0;

  return (
    <span
      aria-label={`Rango ${tier}${showScore ? `, ${safeScore} puntos` : ""}`}
      style={{ ...styles.badge, ...TIER_COLORS[tier] }}
    >
      <span aria-hidden="true" style={styles.mark} />
      <span>{tier}</span>
      {showScore ? <strong style={styles.score}>{safeScore}</strong> : null}
    </span>
  );
}

const styles: Readonly<Record<string, CSSProperties>> = {
  badge: {
    alignItems: "center",
    border: "2px solid",
    borderRadius: "999px",
    boxSizing: "border-box",
    display: "inline-flex",
    fontFamily: "Impact, Haettenschweiler, sans-serif",
    fontSize: "0.875rem",
    gap: "8px",
    letterSpacing: "0.06em",
    lineHeight: 1,
    minHeight: "44px",
    padding: "10px 14px",
    textTransform: "uppercase",
  },
  mark: {
    background: "currentColor",
    borderRadius: "50%",
    boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.15)",
    height: "8px",
    width: "8px",
  },
  score: {
    borderLeft: "1px solid currentColor",
    fontFamily: "system-ui, sans-serif",
    fontSize: "0.75rem",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: 0,
    opacity: 0.9,
    paddingLeft: "8px",
  },
};

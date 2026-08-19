import type { CSSProperties } from "react";

import type { PlayerStateView } from "../../../shared/types";

type FighterHudState = Pick<PlayerStateView, "health" | "charge">;

export interface HudProps {
  player: FighterHudState;
  rival: FighterHudState;
  playerName?: string;
  rivalName?: string;
}

interface MeterProps {
  label: string;
  value: number;
  color: string;
  align?: "left" | "right";
}

function Meter({ label, value, color, align = "left" }: MeterProps) {
  const safeValue = Math.min(100, Math.max(0, value));

  return (
    <div style={styles.meterGroup}>
      <div style={{ ...styles.meterLabel, textAlign: align }}>
        <span>{label}</span>
        <strong>{Math.round(safeValue)}</strong>
      </div>
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(safeValue)}
        role="progressbar"
        style={styles.meterTrack}
      >
        <div
          style={{
            ...styles.meterFill,
            background: color,
            marginLeft: align === "right" ? "auto" : undefined,
            width: `${safeValue}%`,
          }}
        />
      </div>
    </div>
  );
}

export function Hud({
  player,
  rival,
  playerName = "VOS",
  rivalName = "RIVAL",
}: HudProps) {
  return (
    <header aria-label="Estado del combate" style={styles.hud}>
      <section style={styles.fighterPanel}>
        <Meter label={playerName} value={player.health} color="#f2c14e" />
        <Meter label="CARGA" value={player.charge} color="#27d3c2" />
      </section>

      <div aria-hidden="true" style={styles.versusBadge}>
        VS
      </div>

      <section style={styles.fighterPanel}>
        <Meter label={rivalName} value={rival.health} color="#e23b2e" align="right" />
        <Meter label="CARGA RIVAL" value={rival.charge} color="#b87cff" align="right" />
      </section>
    </header>
  );
}

const styles: Readonly<Record<string, CSSProperties>> = {
  hud: {
    alignItems: "start",
    boxSizing: "border-box",
    display: "grid",
    gap: "clamp(8px, 2vw, 20px)",
    gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
    left: 0,
    padding: "clamp(12px, 3vw, 28px)",
    position: "absolute",
    top: 0,
    width: "100%",
    zIndex: 3,
  },
  fighterPanel: {
    display: "grid",
    gap: "8px",
    minWidth: 0,
  },
  meterGroup: {
    minWidth: 0,
  },
  meterLabel: {
    color: "#fff8e7",
    display: "flex",
    fontFamily: "Impact, Haettenschweiler, sans-serif",
    fontSize: "clamp(0.68rem, 2.2vw, 1rem)",
    justifyContent: "space-between",
    letterSpacing: "0.08em",
    marginBottom: "4px",
    textShadow: "2px 2px 0 #17120f",
  },
  meterTrack: {
    background: "#17120f",
    border: "2px solid #fff8e7",
    boxShadow: "3px 3px 0 rgba(0, 0, 0, 0.45)",
    boxSizing: "border-box",
    height: "clamp(14px, 3vw, 22px)",
    overflow: "hidden",
    padding: "2px",
    width: "100%",
  },
  meterFill: {
    height: "100%",
    minWidth: 0,
    transition: "width 120ms linear",
  },
  versusBadge: {
    background: "#fff8e7",
    border: "2px solid #17120f",
    color: "#e23b2e",
    fontFamily: "Impact, Haettenschweiler, sans-serif",
    fontSize: "clamp(0.8rem, 3vw, 1.25rem)",
    lineHeight: 1,
    padding: "7px 6px 5px",
    transform: "rotate(-5deg)",
  },
};

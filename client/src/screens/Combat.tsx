import type { CSSProperties } from "react";

import type { MatchStateView, PlayerStateView, Side } from "../../../shared/types";
import { Hud } from "../components/Hud";

export interface CombatProps {
  state: MatchStateView;
  playerId: string;
  activeGlove?: Side | null;
  onPunch?: (side: Side) => void;
  playerName?: string;
  rivalName?: string;
  reduceMotion?: boolean;
}

const EMPTY_FIGHTER: PlayerStateView = {
  userId: "",
  avatarUrl: "",
  health: 0,
  blocking: false,
  blockSide: null,
  charge: 0,
  stance: "idle",
};

export function Combat({
  state,
  playerId,
  activeGlove = null,
  onPunch,
  playerName,
  rivalName,
  reduceMotion = false,
}: CombatProps) {
  const fighters = Object.values(state.players);
  const player = fighters.find((fighter) => fighter.userId === playerId) ?? EMPTY_FIGHTER;
  const rival = fighters.find((fighter) => fighter.userId !== playerId) ?? EMPTY_FIGHTER;
  const canPunch = state.status === "active" && Boolean(onPunch);

  return (
    <main aria-label="Ring de combate" style={styles.arena}>
      <Hud
        player={player}
        rival={rival}
        playerName={playerName}
        rivalName={rivalName}
      />

      <div aria-hidden="true" style={styles.ceilingLight} />
      <div aria-hidden="true" style={styles.ropeLeft} />
      <div aria-hidden="true" style={styles.ropeRight} />

      <section aria-label="Rival" style={styles.rivalStage}>
        <div style={styles.rivalHalo} />
        {rival.avatarUrl ? (
          <img
            alt={rivalName ? `Avatar de ${rivalName}` : "Avatar del rival"}
            loading="lazy"
            src={rival.avatarUrl}
            style={styles.rivalAvatar}
          />
        ) : (
          <div aria-label="Esperando rival" role="img" style={styles.rivalPlaceholder}>
            ?
          </div>
        )}
        <p aria-live="polite" style={styles.statusBanner}>
          {statusLabel(state.status)}
        </p>
      </section>

      <div style={styles.gloveDeck}>
        <Glove
          active={activeGlove === "left"}
          disabled={!canPunch}
          label="Golpe izquierdo"
          onActivate={() => onPunch?.("left")}
          reduceMotion={reduceMotion}
          side="left"
        />
        <Glove
          active={activeGlove === "right"}
          disabled={!canPunch}
          label="Golpe derecho"
          onActivate={() => onPunch?.("right")}
          reduceMotion={reduceMotion}
          side="right"
        />
      </div>
    </main>
  );
}

interface GloveProps {
  active: boolean;
  disabled: boolean;
  label: string;
  onActivate: () => void;
  reduceMotion: boolean;
  side: Side;
}

function Glove({ active, disabled, label, onActivate, reduceMotion, side }: GloveProps) {
  return (
    <button
      aria-pressed={active}
      disabled={disabled}
      onPointerDown={onActivate}
      style={{
        ...styles.gloveButton,
        opacity: disabled ? 0.72 : 1,
        transform: active
          ? `translateY(-18px) rotate(${side === "left" ? "-8deg" : "8deg"}) scale(1.05)`
          : `rotate(${side === "left" ? "-8deg" : "8deg"})`,
        transition: reduceMotion ? "none" : "transform 100ms ease-out",
      }}
      type="button"
    >
      <span aria-hidden="true" style={styles.gloveFist}>
        <span style={styles.gloveKnuckles} />
      </span>
      <span aria-hidden="true" style={styles.gloveCuff} />
      <span style={styles.visuallyHidden}>{label}</span>
    </button>
  );
}

function statusLabel(status: MatchStateView["status"]): string {
  switch (status) {
    case "waiting":
      return "ESPERANDO RIVAL";
    case "countdown":
      return "PREPARATE";
    case "active":
      return "A PELEAR";
    case "ko":
      return "K.O.";
    case "ended":
      return "FIN DEL COMBATE";
  }
}

const styles: Readonly<Record<string, CSSProperties>> = {
  arena: {
    background:
      "radial-gradient(circle at 50% 42%, #684535 0 14%, #38241f 38%, #17120f 74%)",
    color: "#fff8e7",
    fontFamily: "Georgia, serif",
    isolation: "isolate",
    minHeight: "100dvh",
    overflow: "hidden",
    position: "relative",
  },
  ceilingLight: {
    background: "linear-gradient(180deg, rgba(255,248,231,0.32), transparent)",
    clipPath: "polygon(38% 0, 62% 0, 84% 100%, 16% 100%)",
    height: "76%",
    left: "15%",
    position: "absolute",
    top: 0,
    width: "70%",
  },
  ropeLeft: {
    background: "#ad2e24",
    boxShadow: "0 20px 0 #fff8e7, 0 40px 0 #2b6cb0",
    height: "5px",
    left: "-8%",
    position: "absolute",
    top: "61%",
    transform: "rotate(8deg)",
    width: "48%",
  },
  ropeRight: {
    background: "#ad2e24",
    boxShadow: "0 20px 0 #fff8e7, 0 40px 0 #2b6cb0",
    height: "5px",
    position: "absolute",
    right: "-8%",
    top: "61%",
    transform: "rotate(-8deg)",
    width: "48%",
  },
  rivalStage: {
    alignItems: "center",
    bottom: "16%",
    display: "flex",
    flexDirection: "column",
    left: "50%",
    maxHeight: "63%",
    position: "absolute",
    transform: "translateX(-50%)",
    width: "min(66vw, 520px)",
    zIndex: 1,
  },
  rivalHalo: {
    background: "rgba(242, 193, 78, 0.24)",
    border: "3px solid rgba(242, 193, 78, 0.58)",
    borderRadius: "50%",
    filter: "blur(2px)",
    height: "72%",
    position: "absolute",
    top: "10%",
    width: "92%",
    zIndex: -1,
  },
  rivalAvatar: {
    display: "block",
    maxHeight: "58vh",
    maxWidth: "100%",
    objectFit: "contain",
    objectPosition: "center bottom",
  },
  rivalPlaceholder: {
    alignItems: "center",
    background: "#241c17",
    border: "5px solid #f2c14e",
    borderRadius: "48% 48% 42% 42%",
    color: "#f2c14e",
    display: "flex",
    fontFamily: "Impact, Haettenschweiler, sans-serif",
    fontSize: "clamp(5rem, 25vw, 12rem)",
    height: "min(46vh, 420px)",
    justifyContent: "center",
    width: "min(56vw, 360px)",
  },
  statusBanner: {
    background: "#fff8e7",
    border: "3px solid #17120f",
    boxShadow: "6px 6px 0 #e23b2e",
    color: "#17120f",
    fontFamily: "Impact, Haettenschweiler, sans-serif",
    fontSize: "clamp(0.9rem, 3vw, 1.4rem)",
    letterSpacing: "0.1em",
    margin: "-12px 0 0",
    padding: "8px 18px 6px",
    textAlign: "center",
    transform: "rotate(-2deg)",
  },
  gloveDeck: {
    alignItems: "end",
    bottom: "-28px",
    display: "flex",
    justifyContent: "space-between",
    left: 0,
    padding: "0 clamp(10px, 5vw, 54px)",
    pointerEvents: "none",
    position: "absolute",
    width: "100%",
    zIndex: 2,
  },
  gloveButton: {
    appearance: "none",
    background: "transparent",
    border: 0,
    cursor: "pointer",
    height: "clamp(128px, 29vw, 250px)",
    padding: 0,
    pointerEvents: "auto",
    position: "relative",
    width: "clamp(104px, 25vw, 210px)",
  },
  gloveFist: {
    background: "linear-gradient(145deg, #f15a46, #ad2e24 72%)",
    border: "4px solid #6f1d18",
    borderRadius: "48% 46% 42% 45%",
    boxShadow: "inset 10px 9px 0 rgba(255,255,255,0.12), 7px 9px 0 rgba(0,0,0,0.35)",
    height: "72%",
    left: "5%",
    position: "absolute",
    top: 0,
    width: "90%",
  },
  gloveKnuckles: {
    borderTop: "4px solid rgba(111,29,24,0.65)",
    height: "30%",
    left: "12%",
    position: "absolute",
    top: "27%",
    width: "76%",
  },
  gloveCuff: {
    background: "#f2c14e",
    border: "4px solid #6f1d18",
    bottom: 0,
    height: "34%",
    left: "20%",
    position: "absolute",
    width: "60%",
  },
  visuallyHidden: {
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    height: "1px",
    overflow: "hidden",
    position: "absolute",
    whiteSpace: "nowrap",
    width: "1px",
  },
};

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import type { Client, Session } from "@heroiclabs/nakama-js";

import { RIVALS } from "../../../src/data/rivals";
import {
  classifyRival,
  formatCareerError,
  isCareerCompleted,
  normalizeCareerProgress,
  parseCareerStartResponse,
  type CareerStartResponse,
  type RivalLadderState,
} from "../lib/career-ladder";

export interface CareerLadderProps {
  client?: Client;
  session?: Session;
  initialCareerProgress?: number;
  onBack?: () => void;
  onStartMatch?: (result: CareerStartResponse) => void;
}

const STATE_LABEL: Readonly<Record<RivalLadderState, string>> = {
  beaten: "Vencido",
  current: "Próximo rival",
  locked: "Bloqueado",
};

export function CareerLadder({
  client,
  session,
  initialCareerProgress,
  onBack,
  onStartMatch,
}: CareerLadderProps) {
  const [careerProgress, setCareerProgress] = useState<number>(() =>
    normalizeCareerProgress(initialCareerProgress)
  );
  const [loading, setLoading] = useState<boolean>(
    initialCareerProgress === undefined && Boolean(client && session)
  );
  const [error, setError] = useState<string | null>(null);
  const [startingIndex, setStartingIndex] = useState<number | null>(null);
  const [startedResult, setStartedResult] = useState<CareerStartResponse | null>(
    null
  );

  const loadProgress = useCallback(async () => {
    if (!client || !session) return;
    setLoading(true);
    setError(null);
    try {
      const rpcRes = await client.rpc(session, "get_profile", {});
      const raw = rpcRes.payload;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed && typeof parsed === "object" && "profile" in parsed) {
        const profile = (parsed as { profile: { careerProgress?: unknown } })
          .profile;
        setCareerProgress(normalizeCareerProgress(profile?.careerProgress));
      }
    } catch (err: unknown) {
      setError(formatCareerError(err));
    } finally {
      setLoading(false);
    }
  }, [client, session]);

  useEffect(() => {
    if (initialCareerProgress === undefined && client && session) {
      void loadProgress();
    }
  }, [client, session, initialCareerProgress, loadProgress]);

  const totalRivals = RIVALS.length;
  const completed = isCareerCompleted(careerProgress, totalRivals);
  const beatenCount = completed ? totalRivals : Math.min(careerProgress, totalRivals);
  const progressPercent = totalRivals > 0
    ? Math.round((beatenCount / totalRivals) * 100)
    : 0;

  const handleFight = useCallback(
    async (index: number) => {
      setError(null);
      setStartingIndex(index);

      if (!client || !session) {
        // WHY: sin backend (preview/standalone) emulamos la respuesta para que
        // la pantalla siga siendo usable en el editor sin Nakama.
        const rival = RIVALS[index];
        const fake: CareerStartResponse = {
          matchId: `career-preview-${index}`,
          rival: {
            index,
            name: rival.name,
            portraitUrl: rival.portraitUrl,
            health: rival.health,
          },
          careerProgress: index,
          totalRivals,
        };
        setStartedResult(fake);
        setStartingIndex(null);
        onStartMatch?.(fake);
        return;
      }

      try {
        const rpcRes = await client.rpc(session, "start_career_match", {});
        const result = parseCareerStartResponse(rpcRes.payload);
        setStartedResult(result);
        setStartingIndex(null);
        onStartMatch?.(result);
      } catch (err: unknown) {
        setError(formatCareerError(err));
        setStartingIndex(null);
      }
    },
    [client, session, onStartMatch, totalRivals]
  );

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* HEADER */}
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>MODO CARRERA · PvE</p>
            <h1 style={styles.title}>Escalera de Rivales</h1>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={styles.backButton}
              aria-label="Volver al menú principal"
            >
              ← Volver
            </button>
          )}
        </header>

        {/* PROGRESS SUMMARY */}
        <section aria-labelledby="career-progress-title" style={styles.progressCard}>
          <div style={styles.progressHead}>
            <h2 id="career-progress-title" style={styles.progressTitle}>
              TU AVANCE
            </h2>
            <span style={styles.progressCount}>
              {beatenCount} / {totalRivals}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Progreso de la carrera"
            aria-valuenow={beatenCount}
            aria-valuemin={0}
            aria-valuemax={totalRivals}
            style={styles.progressTrack}
          >
            <div
              style={{ ...styles.progressFill, width: `${progressPercent}%` }}
            />
          </div>
          {completed ? (
            <p style={styles.championLine}>
              👑 ¡Venciste al campeón! La escalera está completa.
            </p>
          ) : (
            <p style={styles.progressHint}>
              Vencé a {RIVALS[careerProgress]?.name ?? "tu rival"} para
              desbloquear el siguiente.
            </p>
          )}
        </section>

        {/* LOADING STATE */}
        {loading && (
          <div role="status" aria-live="polite" style={styles.loadingBox}>
            <span style={styles.loadingGlove}>🥊</span>
            <p style={styles.loadingText}>Cargando la escalera…</p>
          </div>
        )}

        {/* ERROR BANNER */}
        {!loading && error && (
          <div role="alert" style={styles.errorBanner}>
            <p style={styles.errorText}>⚠️ {error}</p>
          </div>
        )}

        {/* MATCH STARTED CONFIRMATION (sin callback de navegación) */}
        {startedResult && !onStartMatch && (
          <div role="status" aria-live="polite" style={styles.startedBox}>
            <p style={styles.startedText}>
              ⚔️ Partida creada contra {startedResult.rival.name}. Match:{" "}
              <span style={styles.startedMatchId}>{startedResult.matchId}</span>
            </p>
          </div>
        )}

        {/* RIVAL GRID */}
        {!loading && (
          <section aria-label="Rivales de la escalera" style={styles.grid}>
            {RIVALS.map((rival, index) => {
              const state = classifyRival(index, careerProgress);
              const isCurrent = state === "current";
              const isLocked = state === "locked";
              const isBeaten = state === "beaten";
              const starting = startingIndex === index;

              return (
                <article
                  key={rival.name}
                  style={{
                    ...styles.rivalCard,
                    ...(isCurrent ? styles.rivalCardCurrent : {}),
                    ...(isLocked ? styles.rivalCardLocked : {}),
                  }}
                  aria-label={`${rival.name}: ${STATE_LABEL[state]}`}
                >
                  <div style={styles.portraitWrap}>
                    {isLocked ? (
                      <div style={styles.lockOverlay} aria-hidden="true">
                        <span style={styles.lockIcon}>🔒</span>
                      </div>
                    ) : (
                      <img
                        src={rival.portraitUrl}
                        alt={`Retrato de ${rival.name}`}
                        loading="lazy"
                        style={styles.portrait}
                      />
                    )}
                    <span style={styles.rivalNumber}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div style={styles.rivalBody}>
                    <h3 style={styles.rivalName}>{rival.name}</h3>
                    <p style={styles.rivalMeta}>
                      HP {rival.health}
                      {rival.usesSpecial ? " · ⚡ especial" : ""}
                    </p>

                    {isBeaten && (
                      <span style={styles.beatenBadge}>✓ Vencido</span>
                    )}
                    {isCurrent && (
                      <button
                        type="button"
                        onClick={() => void handleFight(index)}
                        disabled={starting}
                        style={{
                          ...styles.fightButton,
                          opacity: starting ? 0.6 : 1,
                        }}
                      >
                        {starting ? "Armando…" : "🥊 Pelear"}
                      </button>
                    )}
                    {isLocked && (
                      <span style={styles.lockedBadge}>🔒 Bloqueado</span>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

const styles: Readonly<Record<string, CSSProperties>> = {
  page: {
    background: "#17120f",
    color: "#fff8e7",
    fontFamily: "Georgia, serif",
    minHeight: "100dvh",
    padding: "clamp(12px, 3vw, 28px)",
    boxSizing: "border-box",
  },
  container: {
    margin: "0 auto",
    maxWidth: "1080px",
  },
  header: {
    alignItems: "center",
    borderBottom: "2px solid #382c23",
    display: "flex",
    gap: "16px",
    justifyContent: "space-between",
    marginBottom: "20px",
    paddingBottom: "16px",
  },
  eyebrow: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.95rem",
    letterSpacing: "0.16em",
    margin: "0 0 4px",
    textTransform: "uppercase",
  },
  title: {
    fontSize: "clamp(2rem, 5.5vw, 3rem)",
    lineHeight: 0.95,
    margin: 0,
    textTransform: "uppercase",
  },
  backButton: {
    background: "transparent",
    border: "2px solid #f2c14e",
    color: "#fff8e7",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "1rem",
    letterSpacing: "0.06em",
    minHeight: "44px",
    padding: "8px 18px",
    textTransform: "uppercase",
  },
  progressCard: {
    background: "#241c17",
    border: "3px solid #f2c14e",
    boxShadow: "8px 8px 0 #ad2e24",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "20px",
    padding: "clamp(14px, 3vw, 20px)",
  },
  progressHead: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
  },
  progressTitle: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.1rem",
    letterSpacing: "0.08em",
    margin: 0,
    textTransform: "uppercase",
  },
  progressCount: {
    color: "#ffffff",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.3rem",
    letterSpacing: "0.04em",
  },
  progressTrack: {
    background: "#100b08",
    border: "1px solid #3d2b20",
    height: "18px",
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    background: "#f2c14e",
    height: "100%",
    transition: "width 0.3s ease",
  },
  progressHint: {
    color: "#a89b8d",
    fontSize: "0.85rem",
    margin: 0,
  },
  championLine: {
    color: "#f2c14e",
    fontSize: "0.95rem",
    margin: 0,
  },
  loadingBox: {
    alignItems: "center",
    background: "#241c17",
    border: "2px solid #382c23",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "32px",
    textAlign: "center",
  },
  loadingGlove: {
    fontSize: "2.5rem",
  },
  loadingText: {
    color: "#d8cbbb",
    fontSize: "0.95rem",
    margin: 0,
  },
  errorBanner: {
    alignItems: "center",
    background: "#450a0a",
    border: "2px solid #ef4444",
    boxSizing: "border-box",
    color: "#fecaca",
    display: "flex",
    marginBottom: "16px",
    padding: "12px 18px",
  },
  errorText: {
    fontSize: "0.95rem",
    margin: 0,
  },
  startedBox: {
    background: "#14532d",
    border: "2px solid #22c55e",
    boxSizing: "border-box",
    marginBottom: "16px",
    padding: "14px 18px",
  },
  startedText: {
    color: "#dcfce7",
    fontSize: "0.95rem",
    margin: 0,
  },
  startedMatchId: {
    fontFamily: "monospace",
    fontSize: "0.85rem",
  },
  grid: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  },
  rivalCard: {
    background: "#241c17",
    border: "2px solid #423226",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    padding: "10px",
  },
  rivalCardCurrent: {
    border: "3px solid #f2c14e",
    boxShadow: "5px 5px 0 #ad2e24",
  },
  rivalCardLocked: {
    opacity: 0.5,
  },
  portraitWrap: {
    aspectRatio: "1/1",
    background: "#110c09",
    border: "1px solid #4a382c",
    marginBottom: "10px",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  portrait: {
    display: "block",
    height: "100%",
    objectFit: "cover",
    width: "100%",
  },
  lockOverlay: {
    alignItems: "center",
    background: "#0d0907",
    display: "flex",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  lockIcon: {
    fontSize: "2.4rem",
  },
  rivalNumber: {
    background: "#ad2e24",
    color: "#ffffff",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.8rem",
    letterSpacing: "0.06em",
    padding: "2px 6px",
    position: "absolute",
    right: 0,
    top: 0,
  },
  rivalBody: {
    alignItems: "stretch",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minHeight: 0,
  },
  rivalName: {
    fontFamily: "Impact, sans-serif",
    fontSize: "1.05rem",
    letterSpacing: "0.03em",
    margin: 0,
    textTransform: "uppercase",
  },
  rivalMeta: {
    color: "#a89b8d",
    fontSize: "0.78rem",
    margin: 0,
  },
  beatenBadge: {
    background: "#14532d",
    border: "1px solid #22c55e",
    color: "#86efac",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.8rem",
    letterSpacing: "0.06em",
    padding: "4px 8px",
    textAlign: "center",
    textTransform: "uppercase",
  },
  lockedBadge: {
    background: "#1c1410",
    border: "1px solid #3d2b20",
    color: "#8c7d70",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.8rem",
    letterSpacing: "0.06em",
    padding: "4px 8px",
    textAlign: "center",
    textTransform: "uppercase",
  },
  fightButton: {
    background: "#e23b2e",
    border: "2px solid #ad2e24",
    boxShadow: "3px 3px 0 #ad2e24",
    color: "#ffffff",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.95rem",
    letterSpacing: "0.06em",
    minHeight: "44px",
    padding: "8px 12px",
    textTransform: "uppercase",
  },
};

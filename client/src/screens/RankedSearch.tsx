import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  startRankedSearch,
  type MatchmakerSocket,
  type RankedSearch as ActiveRankedSearch,
} from "../lib/matchmaker";
import type { AudioManager } from "../audio/manager";

export type Tier = "bronce" | "plata" | "oro" | "leyenda_tonta";

export interface TierInfo {
  id: Tier;
  name: string;
  rangeLabel: string;
  minScore: number;
  maxScore: number;
  color: string;
  accentBg: string;
  badge: string;
  description: string;
}

export const TIERS: Readonly<Record<Tier, TierInfo>> = {
  bronce: {
    id: "bronce",
    name: "Bronce",
    rangeLabel: "0 – 999",
    minScore: 0,
    maxScore: 999,
    color: "#cd7f32",
    accentBg: "#382315",
    badge: "🥉",
    description: "Peleadores novatos dando sus primeros golpes en el ring.",
  },
  plata: {
    id: "plata",
    name: "Plata",
    rangeLabel: "1000 – 1399",
    minScore: 1000,
    maxScore: 1399,
    color: "#cbd5e1",
    accentBg: "#1e293b",
    badge: "🥈",
    description: "Boxeadores con técnica sólida y guardia firme.",
  },
  oro: {
    id: "oro",
    name: "Oro",
    rangeLabel: "1400 – 1799",
    minScore: 1400,
    maxScore: 1799,
    color: "#facc15",
    accentBg: "#422006",
    badge: "🥇",
    description: "Veteranos veloces con combos temibles.",
  },
  leyenda_tonta: {
    id: "leyenda_tonta",
    name: "Leyenda Tonta",
    rangeLabel: "1800+",
    minScore: 1800,
    maxScore: Number.POSITIVE_INFINITY,
    color: "#c084fc",
    accentBg: "#3b0764",
    badge: "👑",
    description: "Monstruos del cuadrilátero que no conocen la piedad.",
  },
};

export function getTierFromScore(score: number): TierInfo {
  const safeScore = Math.max(0, Math.floor(score || 0));
  if (safeScore >= 1800) return TIERS.leyenda_tonta;
  if (safeScore >= 1400) return TIERS.oro;
  if (safeScore >= 1000) return TIERS.plata;
  return TIERS.bronce;
}

export interface WideningStage {
  stageNumber: 1 | 2 | 3;
  range: number;
  startSec: number;
  endSec: number;
  title: string;
  description: string;
}

export const WIDENING_STAGES: readonly WideningStage[] = [
  {
    stageNumber: 1,
    range: 150,
    startSec: 0,
    endSec: 10,
    title: "Rango Estricto (±150 ELO)",
    description: "Buscando rivales de habilidad casi idéntica.",
  },
  {
    stageNumber: 2,
    range: 250,
    startSec: 10,
    endSec: 20,
    title: "Rango Ampliado (±250 ELO)",
    description: "Ampliando la búsqueda a rivales en categorías cercanas.",
  },
  {
    stageNumber: 3,
    range: 400,
    startSec: 20,
    endSec: 30,
    title: "Rango Máximo (±400 ELO)",
    description: "Ampliando al límite máximo del reglamento de la liga.",
  },
];

export function getWideningStage(elapsedSeconds: number): WideningStage {
  const safeSeconds = Math.max(0, Math.floor(elapsedSeconds || 0));
  if (safeSeconds >= 20) return WIDENING_STAGES[2];
  if (safeSeconds >= 10) return WIDENING_STAGES[1];
  return WIDENING_STAGES[0];
}

export function calculateRangeBounds(
  rankScore: number,
  range: number
): { min: number; max: number } {
  const safeRank = Math.max(0, Math.floor(rankScore || 0));
  const safeRange = Math.max(0, Math.floor(range || 0));
  return {
    min: Math.max(0, safeRank - safeRange),
    max: safeRank + safeRange,
  };
}

export function formatSearchTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function formatRankedSearchError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (
    msg.includes("401") ||
    msg.toLowerCase().includes("unauthenticated") ||
    msg.includes("UNAUTHENTICATED")
  ) {
    return "Tu sesión de combate venció. Volvé a ingresar para buscar rivales.";
  }
  if (msg.includes("RANK_SCORE_INVALID")) {
    return "Tu puntuación de rango no es válida. Reiniciá tu perfil.";
  }
  if (msg.includes("SOCKET_CLOSED") || msg.toLowerCase().includes("socket")) {
    return "Se perdió la conexión con el servidor del ring. Revisá tu red.";
  }
  return "Ocurrió un error al buscar partida. Podés intentar nuevamente.";
}

export interface MatchmakerResultPayload {
  matchId?: string;
  ticket?: string;
  opponents?: unknown[];
}

export interface RankedSearchProps {
  socket?: MatchmakerSocket;
  rankScore?: number;
  playerName?: string;
  playerAvatarUrl?: string | null;
  audioManager?: AudioManager | null;
  botOfferTimeoutSec?: number;
  reduceMotion?: boolean;
  onBack?: () => void;
  onMatchFound?: (result: MatchmakerResultPayload) => void;
  onPlayBot?: (suggestedRank: number) => void;
}

export type SearchStatus =
  | "idle"
  | "searching"
  | "bot_offer"
  | "matched"
  | "error";

export function RankedSearch({
  socket,
  rankScore = 1000,
  playerName = "Peleador Anónimo",
  playerAvatarUrl = null,
  audioManager,
  botOfferTimeoutSec = 30,
  reduceMotion = false,
  onBack,
  onMatchFound,
  onPlayBot,
}: RankedSearchProps) {
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [currentRange, setCurrentRange] = useState<number>(150);
  const [error, setError] = useState<string | null>(null);
  const [matchedDetails, setMatchedDetails] =
    useState<MatchmakerResultPayload | null>(null);

  const activeSearchRef = useRef<ActiveRankedSearch | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (activeSearchRef.current) {
        void activeSearchRef.current.cancel();
        activeSearchRef.current = null;
      }
    };
  }, []);

  const safeRank = Math.max(0, Math.floor(rankScore || 1000));
  const tier = getTierFromScore(safeRank);
  const stage = getWideningStage(elapsedSeconds);
  const bounds = calculateRangeBounds(safeRank, currentRange);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const handleCancelSearch = useCallback(async () => {
    stopTimer();
    if (activeSearchRef.current) {
      await activeSearchRef.current.cancel();
      activeSearchRef.current = null;
    }
    if (isMountedRef.current) {
      setStatus("idle");
      setElapsedSeconds(0);
      setCurrentRange(150);
      setError(null);
    }
  }, [stopTimer]);

  const handleStartSearch = useCallback(async () => {
    setError(null);
    setElapsedSeconds(0);
    setCurrentRange(150);
    setStatus("searching");

    try {
      audioManager?.playSfx("whoosh");
    } catch {
      // Audio no bloquea el matchmaking
    }

    // WHY: Si hay socket real, invocamos el matchmaker autoritativo
    if (socket) {
      try {
        const search = await startRankedSearch(socket, safeRank, {
          onRangeChanged: (newRange) => {
            if (isMountedRef.current) {
              setCurrentRange(newRange);
              try {
                audioManager?.playSfx("whoosh");
              } catch {
                // Ignore audio errors
              }
            }
          },
          onError: (err) => {
            if (isMountedRef.current) {
              setError(formatRankedSearchError(err));
              setStatus("error");
              stopTimer();
            }
          },
        });
        activeSearchRef.current = search;
      } catch (err) {
        if (isMountedRef.current) {
          setError(formatRankedSearchError(err));
          setStatus("error");
          return;
        }
      }
    }

    // Iniciar cronómetro de búsqueda
    stopTimer();
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        // Si no hay socket (modo simulación/standalone), ampliamos rangos según el timer
        if (!socket) {
          if (next >= 20) {
            setCurrentRange(400);
          } else if (next >= 10) {
            setCurrentRange(250);
          } else {
            setCurrentRange(150);
          }
        }

        // Al alcanzar los 30s (o botOfferTimeoutSec), activar oferta de bot
        if (next >= botOfferTimeoutSec) {
          setStatus((currentStatus) =>
            currentStatus === "searching" ? "bot_offer" : currentStatus
          );
        }

        return next;
      });
    }, 1000);
  }, [socket, safeRank, audioManager, stopTimer, botOfferTimeoutSec]);

  const handleAcceptBot = useCallback(() => {
    void handleCancelSearch();
    try {
      audioManager?.playSfx("pow");
    } catch {
      // Ignore audio error
    }
    if (onPlayBot) {
      onPlayBot(safeRank);
    }
  }, [handleCancelSearch, audioManager, onPlayBot, safeRank]);

  const handleContinueSearching = useCallback(() => {
    setStatus("searching");
  }, []);

  const handleSimulateMatch = useCallback(() => {
    const result: MatchmakerResultPayload = {
      matchId: "ranked-mock-match-id",
      ticket: "ticket-12345",
    };
    stopTimer();
    if (activeSearchRef.current) {
      void activeSearchRef.current.cancel();
      activeSearchRef.current = null;
    }
    setMatchedDetails(result);
    setStatus("matched");
    try {
      audioManager?.playSfx("special");
    } catch {
      // Ignore
    }
    if (onMatchFound) {
      onMatchFound(result);
    }
  }, [stopTimer, audioManager, onMatchFound]);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* HEADER */}
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>MODO RANKED · TEMPORADA 1</p>
            <h1 style={styles.title}>Búsqueda de Partida</h1>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={async () => {
                await handleCancelSearch();
                onBack();
              }}
              style={styles.backButton}
              aria-label="Volver al menú principal"
            >
              ← Volver
            </button>
          )}
        </header>

        {/* ERROR BANNER */}
        {status === "error" && error && (
          <div role="alert" style={styles.errorBanner}>
            <p style={styles.errorText}>⚠️ {error}</p>
            <button
              type="button"
              onClick={() => void handleStartSearch()}
              style={styles.retryButton}
            >
              Reintentar
            </button>
          </div>
        )}

        <div style={styles.layout}>
          {/* FIGHTER INFO CARD */}
          <section aria-labelledby="fighter-profile-title" style={styles.card}>
            <h2 id="fighter-profile-title" style={styles.cardTitle}>
              Tu Ficha de Liga
            </h2>

            <div style={styles.profileHero}>
              <div style={styles.avatarWrap}>
                {playerAvatarUrl ? (
                  <img
                    src={playerAvatarUrl}
                    alt={`Avatar de ${playerName}`}
                    loading="lazy"
                    style={styles.avatarImg}
                  />
                ) : (
                  <div style={styles.avatarPlaceholder}>🥊</div>
                )}
              </div>

              <div style={styles.profileText}>
                <span style={styles.playerName}>{playerName}</span>
                <div style={styles.tierPill}>
                  <span style={styles.tierBadgeIcon}>{tier.badge}</span>
                  <span style={{ ...styles.tierName, color: tier.color }}>
                    {tier.name}
                  </span>
                </div>
                <div style={styles.eloScoreDisplay}>
                  <span style={styles.eloScoreNumber}>{safeRank}</span>
                  <span style={styles.eloScoreLabel}>PUNTOS ELO</span>
                </div>
              </div>
            </div>

            <div style={styles.tierInfoBox}>
              <div style={styles.tierInfoHead}>
                <span style={styles.tierInfoTitle}>CATEGORÍA ACTUAL</span>
                <span style={{ ...styles.tierRangeTag, color: tier.color }}>
                  {tier.rangeLabel} ELO
                </span>
              </div>
              <p style={styles.tierDesc}>{tier.description}</p>
            </div>

            {/* RULES SUMMARY */}
            <div style={styles.rulesList}>
              <div style={styles.ruleItem}>
                <span style={styles.ruleIcon}>⚖️</span>
                <span>
                  <strong>K = 24</strong>: Cálculo Elo simétrico según nivel del
                  rival.
                </span>
              </div>
              <div style={styles.ruleItem}>
                <span style={styles.ruleIcon}>💥</span>
                <span>
                  <strong>+5 ELO extra</strong> por conseguir un K.O. limpio.
                </span>
              </div>
              <div style={styles.ruleItem}>
                <span style={styles.ruleIcon}>🛡️</span>
                <span>
                  <strong>Autoritativo</strong>: El resultado es validado en el
                  servidor.
                </span>
              </div>
            </div>
          </section>

          {/* SEARCH & MATCHMAKER PANEL */}
          <section aria-labelledby="matchmaker-title" style={styles.card}>
            <h2 id="matchmaker-title" style={styles.cardTitle}>
              Radar de Emparejamiento
            </h2>

            {/* IDLE STATE */}
            {status === "idle" && (
              <div style={styles.idleStateContainer}>
                <div style={styles.radarIconWrap}>
                  <span style={styles.idleRadarIcon}>🎯</span>
                </div>
                <h3 style={styles.idleHeading}>¿Listo para subir de rango?</h3>
                <p style={styles.idleDesc}>
                  El sistema buscará un oponente en tu rango de ELO (±150
                  inicial). Si la espera se extiende, el rango se ampliará
                  automáticamente a ±250 y luego a ±400.
                </p>

                <button
                  type="button"
                  onClick={() => void handleStartSearch()}
                  style={styles.searchPrimaryButton}
                >
                  🥊 ¡Buscar Rival Ranked!
                </button>
              </div>
            )}

            {/* SEARCHING OR BOT OFFER STATE */}
            {(status === "searching" || status === "bot_offer") && (
              <div style={styles.searchingContainer}>
                {/* RADAR ANIMATION / GRAPHIC */}
                <div
                  style={{
                    ...styles.radarDisplay,
                    ...(reduceMotion ? styles.radarStatic : {}),
                  }}
                  aria-hidden="true"
                >
                  <div style={styles.radarRingOuter} />
                  <div style={styles.radarRingMiddle} />
                  <div style={styles.radarRingInner} />
                  <div
                    style={{
                      ...styles.radarSweep,
                      animationPlayState: reduceMotion ? "paused" : "running",
                    }}
                  />
                  <div style={styles.radarCenterDot}>🥊</div>
                </div>

                <div
                  role="status"
                  aria-live="polite"
                  style={styles.statusLiveRegion}
                >
                  <p style={styles.searchingStatusTitle}>
                    Buscando contrincante en el ring…
                  </p>
                  <div style={styles.searchTimerDisplay}>
                    ⏱️ {formatSearchTime(elapsedSeconds)}
                  </div>
                </div>

                {/* CURRENT RANGE WINDOW */}
                <div style={styles.currentRangeCard}>
                  <div style={styles.currentRangeHeader}>
                    <span style={styles.currentRangeBadge}>
                      ETAPA {stage.stageNumber}/3
                    </span>
                    <span style={styles.currentRangeTitle}>{stage.title}</span>
                  </div>

                  <div style={styles.boundsVisual}>
                    <div style={styles.boundBox}>
                      <span style={styles.boundLabel}>MÍNIMO</span>
                      <span style={styles.boundValue}>{bounds.min} ELO</span>
                    </div>
                    <div style={styles.boundDivider}>⟷</div>
                    <div style={styles.boundBox}>
                      <span style={styles.boundLabel}>TU RANGO</span>
                      <span
                        style={{ ...styles.boundValue, color: "#f2c14e" }}
                      >
                        {safeRank}
                      </span>
                    </div>
                    <div style={styles.boundDivider}>⟷</div>
                    <div style={styles.boundBox}>
                      <span style={styles.boundLabel}>MÁXIMO</span>
                      <span style={styles.boundValue}>{bounds.max} ELO</span>
                    </div>
                  </div>

                  <p style={styles.stageDescText}>{stage.description}</p>
                </div>

                {/* STAGE TRACKER */}
                <div style={styles.stagesProgressRow}>
                  {WIDENING_STAGES.map((stg) => {
                    const isActive = stage.stageNumber === stg.stageNumber;
                    const isPassed = stage.stageNumber > stg.stageNumber;
                    return (
                      <div
                        key={stg.stageNumber}
                        style={{
                          ...styles.stageStepPill,
                          borderColor: isActive
                            ? "#f2c14e"
                            : isPassed
                            ? "#22c55e"
                            : "#423226",
                          background: isActive
                            ? "#382318"
                            : isPassed
                            ? "#14532d"
                            : "#19110d",
                        }}
                      >
                        <span style={styles.stagePillStep}>
                          {isPassed ? "✓" : `±${stg.range}`}
                        </span>
                        <span style={styles.stagePillTime}>
                          {stg.startSec}s - {stg.endSec}s
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* BOT FALLBACK OFFER (AFTER 30 SECONDS) */}
                {status === "bot_offer" && (
                  <div
                    role="dialog"
                    aria-labelledby="bot-offer-title"
                    style={styles.botOfferBox}
                  >
                    <div style={styles.botOfferHeader}>
                      <span style={styles.botOfferIcon}>🤖</span>
                      <div>
                        <h4 id="bot-offer-title" style={styles.botOfferTitle}>
                          ¿Mucho tiempo esperando?
                        </h4>
                        <p style={styles.botOfferDesc}>
                          Pasaron más de 30s sin un rival en tu rango. Podés
                          pelear contra una IA de sparring calibrada a tu nivel
                          o seguir esperando en la cola.
                        </p>
                      </div>
                    </div>

                    <div style={styles.botOfferActions}>
                      <button
                        type="button"
                        onClick={handleAcceptBot}
                        style={styles.botAcceptButton}
                      >
                        🥊 Pelear vs Bot IA
                      </button>
                      <button
                        type="button"
                        onClick={handleContinueSearching}
                        style={styles.botKeepWaitingButton}
                      >
                        ⏳ Seguir buscando rival humano
                      </button>
                    </div>
                  </div>
                )}

                {/* CANCEL & DEV SIMULATE ACTIONS */}
                <div style={styles.searchActionsRow}>
                  <button
                    type="button"
                    onClick={() => void handleCancelSearch()}
                    style={styles.cancelSearchButton}
                  >
                    ✖ Cancelar Búsqueda
                  </button>

                  {/* Botón utilitario si no hay socket conectado para pruebas */}
                  {!socket && (
                    <button
                      type="button"
                      onClick={handleSimulateMatch}
                      style={styles.mockMatchButton}
                    >
                      ⚡ Simular Encuentro
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* MATCHED STATE */}
            {status === "matched" && (
              <div
                role="status"
                aria-live="assertive"
                style={styles.matchedContainer}
              >
                <div style={styles.matchedIconWrap}>
                  <span style={styles.matchedGloveIcon}>🥊</span>
                </div>
                <h3 style={styles.matchedHeading}>¡RIVAL ENCONTRADO!</h3>
                <p style={styles.matchedDesc}>
                  Contrincante listo. Cargando las cuerdas del cuadrilátero...
                </p>
                {matchedDetails?.matchId && (
                  <div style={styles.matchedDetailsTag}>
                    Sala de match: {matchedDetails.matchId}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
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
    maxWidth: "960px",
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
  errorBanner: {
    alignItems: "center",
    background: "#450a0a",
    border: "2px solid #ef4444",
    boxSizing: "border-box",
    color: "#fecaca",
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    justifyContent: "space-between",
    marginBottom: "20px",
    padding: "12px 18px",
  },
  errorText: {
    fontSize: "0.95rem",
    margin: 0,
  },
  retryButton: {
    background: "#ef4444",
    border: 0,
    color: "#ffffff",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.9rem",
    letterSpacing: "0.06em",
    minHeight: "36px",
    padding: "6px 14px",
    textTransform: "uppercase",
  },
  layout: {
    display: "grid",
    gap: "20px",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  },
  card: {
    background: "#241c17",
    border: "3px solid #f2c14e",
    boxShadow: "8px 8px 0 #ad2e24",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "clamp(16px, 3vw, 24px)",
  },
  cardTitle: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.4rem",
    letterSpacing: "0.06em",
    margin: 0,
    textTransform: "uppercase",
  },
  profileHero: {
    alignItems: "center",
    background: "#18120e",
    border: "1px solid #4a382c",
    display: "flex",
    gap: "16px",
    padding: "14px",
  },
  avatarWrap: {
    aspectRatio: "1/1",
    background: "#110c09",
    border: "2px solid #f2c14e",
    height: "76px",
    minWidth: "76px",
    overflow: "hidden",
    width: "76px",
  },
  avatarImg: {
    display: "block",
    height: "100%",
    objectFit: "cover",
    width: "100%",
  },
  avatarPlaceholder: {
    alignItems: "center",
    display: "flex",
    fontSize: "2.4rem",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  profileText: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  playerName: {
    fontFamily: "Impact, sans-serif",
    fontSize: "1.3rem",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  tierPill: {
    alignItems: "center",
    display: "flex",
    gap: "6px",
  },
  tierBadgeIcon: {
    fontSize: "1.2rem",
  },
  tierName: {
    fontFamily: "Impact, sans-serif",
    fontSize: "1.05rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  eloScoreDisplay: {
    alignItems: "baseline",
    display: "flex",
    gap: "6px",
  },
  eloScoreNumber: {
    color: "#ffffff",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.6rem",
    lineHeight: 1,
  },
  eloScoreLabel: {
    color: "#a89b8d",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.75rem",
    letterSpacing: "0.08em",
  },
  tierInfoBox: {
    background: "#19110d",
    border: "1px solid #423226",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "12px 14px",
  },
  tierInfoHead: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
  },
  tierInfoTitle: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.8rem",
    letterSpacing: "0.08em",
  },
  tierRangeTag: {
    fontFamily: "Impact, sans-serif",
    fontSize: "0.88rem",
    letterSpacing: "0.06em",
  },
  tierDesc: {
    color: "#d8cbbb",
    fontSize: "0.86rem",
    lineHeight: 1.35,
    margin: 0,
  },
  rulesList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  ruleItem: {
    alignItems: "flex-start",
    background: "#1c1410",
    border: "1px solid #3d2b20",
    color: "#d8cbbb",
    display: "flex",
    fontSize: "0.84rem",
    gap: "8px",
    lineHeight: 1.3,
    padding: "8px 10px",
  },
  ruleIcon: {
    fontSize: "1rem",
  },
  idleStateContainer: {
    alignItems: "center",
    display: "flex",
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    padding: "20px 8px",
    textAlign: "center",
  },
  radarIconWrap: {
    alignItems: "center",
    background: "#18120e",
    border: "2px solid #f2c14e",
    borderRadius: "50%",
    display: "flex",
    height: "80px",
    justifyContent: "center",
    marginBottom: "16px",
    width: "80px",
  },
  idleRadarIcon: {
    fontSize: "2.5rem",
  },
  idleHeading: {
    fontFamily: "Impact, sans-serif",
    fontSize: "1.4rem",
    letterSpacing: "0.04em",
    margin: "0 0 8px",
    textTransform: "uppercase",
  },
  idleDesc: {
    color: "#d8cbbb",
    fontSize: "0.9rem",
    lineHeight: 1.45,
    margin: "0 0 24px",
    maxWidth: "380px",
  },
  searchPrimaryButton: {
    background: "#e23b2e",
    border: "2px solid #ad2e24",
    boxShadow: "4px 4px 0 #ad2e24",
    color: "#ffffff",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.2rem",
    letterSpacing: "0.08em",
    minHeight: "48px",
    padding: "12px 28px",
    textTransform: "uppercase",
    width: "100%",
  },
  searchingContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  radarDisplay: {
    alignItems: "center",
    background: "#0d0907",
    border: "2px solid #f2c14e",
    boxShadow: "inset 0 0 24px rgba(242, 193, 78, 0.15)",
    display: "flex",
    height: "180px",
    justifyContent: "center",
    margin: "0 auto",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  radarStatic: {},
  radarRingOuter: {
    border: "1px dashed rgba(242, 193, 78, 0.3)",
    borderRadius: "50%",
    height: "150px",
    position: "absolute",
    width: "150px",
  },
  radarRingMiddle: {
    border: "1px solid rgba(242, 193, 78, 0.4)",
    borderRadius: "50%",
    height: "100px",
    position: "absolute",
    width: "100px",
  },
  radarRingInner: {
    border: "1px dashed rgba(242, 193, 78, 0.6)",
    borderRadius: "50%",
    height: "50px",
    position: "absolute",
    width: "50px",
  },
  radarSweep: {
    background:
      "conic-gradient(from 0deg at 50% 50%, rgba(242, 193, 78, 0.35) 0deg, rgba(242, 193, 78, 0) 60deg, transparent 360deg)",
    borderRadius: "50%",
    height: "180px",
    position: "absolute",
    width: "180px",
  },
  radarCenterDot: {
    fontSize: "1.4rem",
    position: "relative",
    zIndex: 2,
  },
  statusLiveRegion: {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    justifyContent: "space-between",
  },
  searchingStatusTitle: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.1rem",
    letterSpacing: "0.04em",
    margin: 0,
    textTransform: "uppercase",
  },
  searchTimerDisplay: {
    background: "#18120e",
    border: "1px solid #f2c14e",
    color: "#ffffff",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.1rem",
    letterSpacing: "0.08em",
    padding: "4px 10px",
  },
  currentRangeCard: {
    background: "#19110d",
    border: "1px solid #4a382c",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "14px",
  },
  currentRangeHeader: {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    justifyContent: "space-between",
  },
  currentRangeBadge: {
    background: "#e23b2e",
    color: "#ffffff",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.72rem",
    letterSpacing: "0.08em",
    padding: "2px 6px",
  },
  currentRangeTitle: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.95rem",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  boundsVisual: {
    alignItems: "center",
    background: "#100b08",
    border: "1px solid #3d2b20",
    display: "flex",
    justifyContent: "space-around",
    padding: "8px 4px",
  },
  boundBox: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  boundLabel: {
    color: "#8c7d70",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.68rem",
    letterSpacing: "0.08em",
  },
  boundValue: {
    color: "#ffffff",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.2rem",
    lineHeight: 1,
  },
  boundDivider: {
    color: "#5a4537",
    fontSize: "1.1rem",
  },
  stageDescText: {
    color: "#a89b8d",
    fontSize: "0.82rem",
    margin: 0,
  },
  stagesProgressRow: {
    display: "grid",
    gap: "8px",
    gridTemplateColumns: "repeat(3, 1fr)",
  },
  stageStepPill: {
    alignItems: "center",
    border: "1px solid",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "6px 4px",
    textAlign: "center",
  },
  stagePillStep: {
    fontFamily: "Impact, sans-serif",
    fontSize: "0.85rem",
    letterSpacing: "0.04em",
  },
  stagePillTime: {
    color: "#8c7d70",
    fontSize: "0.68rem",
  },
  botOfferBox: {
    background: "#2a150c",
    border: "2px solid #fb923c",
    boxShadow: "0 4px 12px rgba(251, 146, 60, 0.15)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "14px",
  },
  botOfferHeader: {
    alignItems: "flex-start",
    display: "flex",
    gap: "12px",
  },
  botOfferIcon: {
    fontSize: "2rem",
  },
  botOfferTitle: {
    color: "#fed7aa",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.1rem",
    letterSpacing: "0.04em",
    margin: "0 0 4px",
    textTransform: "uppercase",
  },
  botOfferDesc: {
    color: "#ffedd5",
    fontSize: "0.85rem",
    lineHeight: 1.35,
    margin: 0,
  },
  botOfferActions: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  botAcceptButton: {
    background: "#ea580c",
    border: "1px solid #fb923c",
    color: "#ffffff",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "1rem",
    letterSpacing: "0.06em",
    minHeight: "44px",
    padding: "10px 16px",
    textTransform: "uppercase",
  },
  botKeepWaitingButton: {
    background: "transparent",
    border: "1px solid #7c2d12",
    color: "#fed7aa",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.85rem",
    letterSpacing: "0.04em",
    minHeight: "38px",
    padding: "6px 12px",
    textTransform: "uppercase",
  },
  searchActionsRow: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "4px",
  },
  cancelSearchButton: {
    background: "#382318",
    border: "2px solid #ad2e24",
    color: "#fecaca",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.05rem",
    letterSpacing: "0.06em",
    minHeight: "44px",
    padding: "10px 18px",
    textTransform: "uppercase",
  },
  mockMatchButton: {
    background: "#18120e",
    border: "1px dashed #f2c14e",
    color: "#f2c14e",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.85rem",
    letterSpacing: "0.06em",
    minHeight: "36px",
    padding: "6px 14px",
    textTransform: "uppercase",
  },
  matchedContainer: {
    alignItems: "center",
    background: "#14532d",
    border: "2px solid #22c55e",
    boxShadow: "0 0 20px rgba(34, 197, 94, 0.3)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "36px 18px",
    textAlign: "center",
  },
  matchedIconWrap: {
    fontSize: "3.5rem",
  },
  matchedGloveIcon: {
    display: "inline-block",
  },
  matchedHeading: {
    color: "#86efac",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.8rem",
    letterSpacing: "0.08em",
    margin: 0,
    textTransform: "uppercase",
  },
  matchedDesc: {
    color: "#dcfce7",
    fontSize: "0.95rem",
    margin: 0,
  },
  matchedDetailsTag: {
    background: "#052e16",
    border: "1px solid #16a34a",
    color: "#86efac",
    fontFamily: "monospace",
    fontSize: "0.82rem",
    marginTop: "8px",
    padding: "4px 8px",
  },
};

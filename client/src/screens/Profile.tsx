import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import type { Client, Session } from "@heroiclabs/nakama-js";

import {
  ACHIEVEMENTS,
  type AchievementId,
} from "../../../src/data/achievements";
import {
  levelFromXp,
  xpNeededForLevel,
} from "../../../src/lib/xp";

export interface ProfileData {
  displayName: string;
  avatarUrl: string | null;
  avatarStyle: string | null;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  kos: number;
  rankScore: number;
  careerProgress: number;
  unlocks: string[];
}

export const DEFAULT_PROFILE: ProfileData = {
  displayName: "Peleador Anónimo",
  avatarUrl: null,
  avatarStyle: null,
  level: 1,
  xp: 0,
  wins: 0,
  losses: 0,
  kos: 0,
  rankScore: 1000,
  careerProgress: 0,
  unlocks: [],
};

export interface LevelProgress {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  neededForNextLevel: number;
  progressPercent: number;
  remainingXp: number;
}

export function calculateLevelProgress(
  xp: number,
  explicitLevel?: number
): LevelProgress {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  const computedLevel = levelFromXp(safeXp);
  const level =
    explicitLevel && explicitLevel > 0
      ? Math.max(explicitLevel, computedLevel)
      : computedLevel;

  let cumulativeBaseXp = 0;
  for (let l = 1; l < level; l++) {
    cumulativeBaseXp += xpNeededForLevel(l);
  }

  const neededForNextLevel = xpNeededForLevel(level);
  const currentLevelXp = Math.max(0, safeXp - cumulativeBaseXp);
  const progressPercent =
    neededForNextLevel > 0
      ? Math.min(
          100,
          Math.max(0, Math.floor((currentLevelXp / neededForNextLevel) * 100))
        )
      : 100;
  const remainingXp = Math.max(0, neededForNextLevel - currentLevelXp);

  return {
    level,
    totalXp: safeXp,
    currentLevelXp,
    neededForNextLevel,
    progressPercent,
    remainingXp,
  };
}

export function calculateWinRate(wins: number, losses: number): number {
  const safeWins = Math.max(0, wins || 0);
  const safeLosses = Math.max(0, losses || 0);
  const total = safeWins + safeLosses;
  if (total === 0) return 0;
  return Math.round((safeWins / total) * 100);
}

export interface AchievementDisplayMeta {
  id: AchievementId;
  name: string;
  description: string;
  icon: string;
  accentColor: string;
  badge: string;
}

export const ACHIEVEMENT_META: Readonly<
  Record<AchievementId, AchievementDisplayMeta>
> = {
  first_blood: {
    id: "first_blood",
    name: "Primera Sangre",
    description: "Conseguí tu primer K.O.",
    icon: "🥊",
    accentColor: "#ef4444",
    badge: "COMBATE",
  },
  cara_de_piedra: {
    id: "cara_de_piedra",
    name: "Cara de Piedra",
    description: "Ganá un combate sin recibir golpes.",
    icon: "🗿",
    accentColor: "#38bdf8",
    badge: "DEFENSA",
  },
  remontada: {
    id: "remontada",
    name: "Remontada",
    description: "Ganá un combate con menos de 10 HP.",
    icon: "🔥",
    accentColor: "#fbbf24",
    badge: "ÉPICO",
  },
  campeon: {
    id: "campeon",
    name: "Campeón",
    description: "Vencé al rival 10 del modo Carrera.",
    icon: "👑",
    accentColor: "#a855f7",
    badge: "HISTORIA",
  },
};

export function isAchievementUnlocked(
  id: AchievementId,
  unlockedSet: ReadonlySet<string> | ReadonlyArray<string>
): boolean {
  if (unlockedSet instanceof Set) {
    return unlockedSet.has(id);
  }
  if (Array.isArray(unlockedSet)) {
    return unlockedSet.includes(id);
  }
  return false;
}

export function getUnlockedAchievementsCount(
  unlockedSet: ReadonlySet<string> | ReadonlyArray<string>
): { unlocked: number; total: number; percentage: number } {
  const total = ACHIEVEMENTS.length;
  let unlocked = 0;
  for (const ach of ACHIEVEMENTS) {
    if (isAchievementUnlocked(ach.id, unlockedSet)) {
      unlocked++;
    }
  }
  const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  return { unlocked, total, percentage };
}

export function formatProfileError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("401") ||
    message.toLowerCase().includes("unauthenticated") ||
    message.includes("UNAUTHENTICATED")
  ) {
    return "Tu sesión venció o no está autenticada. Volvé a ingresar.";
  }
  if (message.includes("PROFILE_NOT_FOUND")) {
    return "No encontramos el perfil solicitado.";
  }
  return "No pudimos cargar la información del perfil. Revisá tu conexión e intentá de nuevo.";
}

export interface ProfileProps {
  client?: Client;
  session?: Session;
  userId?: string;
  initialProfile?: ProfileData;
  initialAchievements?: ReadonlyArray<string>;
  onBack?: () => void;
  onEditAvatar?: () => void;
  onPlayMatch?: () => void;
}

export function Profile({
  client,
  session,
  userId,
  initialProfile,
  initialAchievements,
  onBack,
  onEditAvatar,
  onPlayMatch,
}: ProfileProps) {
  const [profile, setProfile] = useState<ProfileData>(
    initialProfile ?? DEFAULT_PROFILE
  );
  const [unlockedAchievements, setUnlockedAchievements] = useState<
    Set<string>
  >(() => new Set(initialAchievements ?? []));
  const [loading, setLoading] = useState<boolean>(
    !initialProfile && Boolean(client && session)
  );
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId ?? session?.user_id;

  const loadData = useCallback(async () => {
    if (!client || !session) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Profile via get_profile RPC
      const rpcPayload = userId ? { userId } : {};
      const rpcRes = await client.rpc(session, "get_profile", rpcPayload);
      const raw = rpcRes.payload;
      const parsed =
        typeof raw === "string" ? JSON.parse(raw) : (raw as unknown);

      if (parsed && typeof parsed === "object" && "profile" in parsed) {
        setProfile((parsed as { profile: ProfileData }).profile);
      }

      // 2. Fetch Achievements from Nakama Storage
      const storageUserId = targetUserId;
      if (storageUserId) {
        try {
          const listRes = await client.listStorageObjects(
            session,
            "achievements",
            storageUserId,
            100
          );
          const keys = new Set<string>();
          if (listRes.objects) {
            for (const obj of listRes.objects) {
              if (obj.key) keys.add(obj.key);
            }
          }
          setUnlockedAchievements(keys);
        } catch {
          // Si no tiene permisos de listado o no hay storage de logros,
          // preservamos logros previos sin quebrar el perfil.
        }
      }
    } catch (loadErr: unknown) {
      setError(formatProfileError(loadErr));
    } finally {
      setLoading(false);
    }
  }, [client, session, userId, targetUserId]);

  useEffect(() => {
    if (!initialProfile && client && session) {
      void loadData();
    }
  }, [client, session, loadData, initialProfile]);

  const levelProgress = calculateLevelProgress(profile.xp, profile.level);
  const winRate = calculateWinRate(profile.wins, profile.losses);
  const achievementStats = getUnlockedAchievementsCount(unlockedAchievements);
  const totalMatches = profile.wins + profile.losses;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* HEADER */}
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>PUNCH AVATAR · FICHA DE PELEADOR</p>
            <h1 id="profile-heading" style={styles.title}>
              {profile.displayName || "Perfil del Ring"}
            </h1>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={styles.backButton}
              aria-label="Volver"
            >
              ← Volver
            </button>
          )}
        </header>

        {/* LOADING STATE */}
        {loading && (
          <div
            role="status"
            aria-live="polite"
            style={styles.loadingContainer}
          >
            <span style={styles.loadingGlove}>🥊</span>
            <p style={styles.loadingText}>Cargando datos del peleador…</p>
          </div>
        )}

        {/* ERROR BANNER */}
        {!loading && error && (
          <div role="alert" style={styles.errorBanner}>
            <p style={styles.errorText}>⚠️ {error}</p>
            <button
              type="button"
              onClick={() => void loadData()}
              style={styles.retryButton}
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && (
          <div style={styles.content}>
            {/* HERO FIGHTER CARD */}
            <section aria-labelledby="fighter-card-title" style={styles.card}>
              <h2 id="fighter-card-title" style={styles.srOnly}>
                Datos principales del boxeador
              </h2>

              <div style={styles.fighterHero}>
                {/* AVATAR BOX */}
                <div style={styles.avatarSection}>
                  <div style={styles.avatarFrame}>
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt={`Avatar de ${profile.displayName}`}
                        loading="lazy"
                        style={styles.avatarImg}
                      />
                    ) : (
                      <div style={styles.avatarPlaceholder}>
                        <span style={styles.placeholderIcon}>🥊</span>
                        <span style={styles.placeholderLabel}>Sin foto</span>
                      </div>
                    )}
                    {profile.avatarStyle && (
                      <div style={styles.styleBadge}>
                        {profile.avatarStyle.replace("_", " ").toUpperCase()}
                      </div>
                    )}
                  </div>

                  {onEditAvatar && (
                    <button
                      type="button"
                      onClick={onEditAvatar}
                      style={styles.editAvatarBtn}
                    >
                      {profile.avatarUrl ? "Cambiar estilo" : "Crear avatar IA"}
                    </button>
                  )}
                </div>

                {/* FIGHTER INFO & LEVEL */}
                <div style={styles.fighterDetails}>
                  <div style={styles.fighterHeaderRow}>
                    <div>
                      <span style={styles.displayName}>
                        {profile.displayName}
                      </span>
                      <div style={styles.metaRow}>
                        <span style={styles.rankBadge}>
                          ⭐ {profile.rankScore} ELO
                        </span>
                        <span style={styles.careerBadge}>
                          🥊 Rival Carrera #{profile.careerProgress + 1}
                        </span>
                      </div>
                    </div>

                    <div style={styles.levelBadge}>
                      <span style={styles.levelLabel}>NIVEL</span>
                      <span style={styles.levelNumber}>
                        {levelProgress.level}
                      </span>
                    </div>
                  </div>

                  {/* XP PROGRESS BAR */}
                  <div style={styles.xpSection}>
                    <div style={styles.xpHeader}>
                      <span style={styles.xpTitle}>PROGRESIÓN DE XP</span>
                      <span style={styles.xpNumbers}>
                        <strong>{levelProgress.currentLevelXp}</strong> /{" "}
                        {levelProgress.neededForNextLevel} XP (
                        {levelProgress.progressPercent}%)
                      </span>
                    </div>

                    <div
                      role="progressbar"
                      aria-label="Progreso de nivel"
                      aria-valuenow={levelProgress.currentLevelXp}
                      aria-valuemin={0}
                      aria-valuemax={levelProgress.neededForNextLevel}
                      style={styles.xpTrack}
                    >
                      <div
                        style={{
                          ...styles.xpFill,
                          width: `${levelProgress.progressPercent}%`,
                        }}
                      />
                    </div>

                    <div style={styles.xpFooter}>
                      <span style={styles.xpRemaining}>
                        Faltan{" "}
                        <strong>{levelProgress.remainingXp} XP</strong> para el
                        Nivel {levelProgress.level + 1}
                      </span>
                      <span style={styles.xpTotal}>
                        Total: {levelProgress.totalXp} XP
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* COMBAT STATS SECTION */}
            <section aria-labelledby="stats-heading" style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 id="stats-heading" style={styles.sectionTitle}>
                  RÉCORD DE COMBATE
                </h2>
                <span style={styles.sectionSubtitle}>
                  {totalMatches} combates disputados
                </span>
              </div>

              <div style={styles.statsGrid}>
                <div style={styles.statBox}>
                  <span style={styles.statLabel}>VICTORIAS</span>
                  <span
                    style={{ ...styles.statValue, color: "#86efac" }}
                  >
                    {profile.wins}
                  </span>
                  <span style={styles.statSub}>peleas ganadas</span>
                </div>

                <div style={styles.statBox}>
                  <span style={styles.statLabel}>DERROTAS</span>
                  <span
                    style={{ ...styles.statValue, color: "#fca5a5" }}
                  >
                    {profile.losses}
                  </span>
                  <span style={styles.statSub}>caídas en el ring</span>
                </div>

                <div style={styles.statBox}>
                  <span style={styles.statLabel}>K.O.s LIMPIOS</span>
                  <span
                    style={{ ...styles.statValue, color: "#f2c14e" }}
                  >
                    {profile.kos}
                  </span>
                  <span style={styles.statSub}>nocauts directos</span>
                </div>

                <div style={styles.statBox}>
                  <span style={styles.statLabel}>EFECTIVIDAD</span>
                  <span
                    style={{ ...styles.statValue, color: "#38bdf8" }}
                  >
                    {winRate}%
                  </span>
                  <span style={styles.statSub}>tasa de victoria</span>
                </div>

                <div style={styles.statBox}>
                  <span style={styles.statLabel}>RATING ELO</span>
                  <span
                    style={{ ...styles.statValue, color: "#c084fc" }}
                  >
                    {profile.rankScore}
                  </span>
                  <span style={styles.statSub}>puntos de liga</span>
                </div>

                <div style={styles.statBox}>
                  <span style={styles.statLabel}>ESCALERA PVE</span>
                  <span
                    style={{ ...styles.statValue, color: "#fb923c" }}
                  >
                    {profile.careerProgress} / 10
                  </span>
                  <span style={styles.statSub}>rivales superados</span>
                </div>
              </div>
            </section>

            {/* ACHIEVEMENTS (LOGROS) SECTION */}
            <section
              aria-labelledby="achievements-heading"
              style={styles.card}
            >
              <div style={styles.sectionHeader}>
                <div>
                  <h2 id="achievements-heading" style={styles.sectionTitle}>
                    LOGROS Y HAZAÑAS
                  </h2>
                  <p style={styles.sectionSubtitle}>
                    Completá proezas en combate para forjar tu reputación.
                  </p>
                </div>
                <div style={styles.achievementBadgeCounter}>
                  🏆 {achievementStats.unlocked} / {achievementStats.total} (
                  {achievementStats.percentage}%)
                </div>
              </div>

              <div
                role="list"
                aria-label="Lista de logros del boxeador"
                style={styles.achievementsGrid}
              >
                {ACHIEVEMENTS.map((ach) => {
                  const meta = ACHIEVEMENT_META[ach.id];
                  const unlocked = isAchievementUnlocked(
                    ach.id,
                    unlockedAchievements
                  );

                  return (
                    <div
                      key={ach.id}
                      role="listitem"
                      aria-label={`${meta.name}: ${unlocked ? "Desbloqueado" : "Bloqueado"}`}
                      style={{
                        ...styles.achievementCard,
                        borderColor: unlocked ? meta.accentColor : "#423226",
                        background: unlocked ? "#261a14" : "#19110d",
                        boxShadow: unlocked
                          ? `0 4px 0 ${meta.accentColor}`
                          : "none",
                      }}
                    >
                      <div
                        style={{
                          ...styles.achievementIconWrap,
                          borderColor: unlocked ? meta.accentColor : "#5a4537",
                          background: unlocked ? "#382318" : "#130d0a",
                          filter: unlocked ? "none" : "grayscale(100%)",
                          opacity: unlocked ? 1 : 0.45,
                        }}
                      >
                        <span style={styles.achievementIcon}>{meta.icon}</span>
                      </div>

                      <div style={styles.achievementBody}>
                        <div style={styles.achievementTitleRow}>
                          <h3
                            style={{
                              ...styles.achievementName,
                              color: unlocked ? "#fff8e7" : "#9e8e80",
                            }}
                          >
                            {meta.name}
                          </h3>
                          <span
                            style={{
                              ...styles.achievementStatusTag,
                              borderColor: unlocked ? "#22c55e" : "#5a4537",
                              color: unlocked ? "#86efac" : "#786555",
                              background: unlocked ? "#14532d" : "#241a14",
                            }}
                          >
                            {unlocked ? "✓ DESBLOQUEADO" : "🔒 BLOQUEADO"}
                          </span>
                        </div>

                        <p
                          style={{
                            ...styles.achievementDesc,
                            color: unlocked ? "#d8cbbb" : "#6c5d51",
                          }}
                        >
                          {meta.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* UNLOCKS SUMMARY SECTION */}
            <section aria-labelledby="unlocks-heading" style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 id="unlocks-heading" style={styles.sectionTitle}>
                  COSMÉTICOS DESBLOQUEADOS
                </h2>
                <span style={styles.sectionSubtitle}>
                  {profile.unlocks.length} objetos en tu casillero
                </span>
              </div>

              <div style={styles.unlocksSummaryRow}>
                <div style={styles.unlockMiniBadge}>
                  <span style={styles.unlockMiniIcon}>🥊</span>
                  <span>Guantes de pelea</span>
                </div>
                <div style={styles.unlockMiniBadge}>
                  <span style={styles.unlockMiniIcon}>🎨</span>
                  <span>Estilos de Avatar</span>
                </div>
                <div style={styles.unlockMiniBadge}>
                  <span style={styles.unlockMiniIcon}>💥</span>
                  <span>Frases de impacto cómic</span>
                </div>
              </div>
            </section>

            {/* ACTION ROW */}
            {onPlayMatch && (
              <div style={styles.actionRow}>
                <button
                  type="button"
                  onClick={onPlayMatch}
                  style={styles.playButton}
                >
                  🥊 ¡Ir al Cuadrilátero a Pelear!
                </button>
              </div>
            )}
          </div>
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
    maxWidth: "840px",
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
    fontSize: "clamp(2rem, 6vw, 3rem)",
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
  loadingContainer: {
    alignItems: "center",
    background: "#241c17",
    border: "3px solid #f2c14e",
    boxShadow: "8px 8px 0 #ad2e24",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "48px 24px",
    textAlign: "center",
  },
  loadingGlove: {
    fontSize: "3rem",
  },
  loadingText: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.3rem",
    letterSpacing: "0.08em",
    margin: 0,
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
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  card: {
    background: "#241c17",
    border: "3px solid #f2c14e",
    boxShadow: "8px 8px 0 #ad2e24",
    boxSizing: "border-box",
    padding: "clamp(16px, 3.5vw, 28px)",
  },
  srOnly: {
    border: 0,
    clip: "rect(0 0 0 0)",
    height: "1px",
    margin: "-1px",
    overflow: "hidden",
    padding: 0,
    position: "absolute",
    width: "1px",
  },
  fighterHero: {
    display: "grid",
    gap: "24px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  avatarSection: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  avatarFrame: {
    aspectRatio: "1/1",
    background: "#17120f",
    border: "3px solid #f2c14e",
    boxShadow: "0 0 16px rgba(242, 193, 78, 0.2)",
    maxHeight: "220px",
    maxWidth: "220px",
    overflow: "hidden",
    position: "relative",
    width: "100%",
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
    flexDirection: "column",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  placeholderIcon: {
    fontSize: "3.5rem",
  },
  placeholderLabel: {
    color: "#a89b8d",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.85rem",
    letterSpacing: "0.1em",
    marginTop: "4px",
    textTransform: "uppercase",
  },
  styleBadge: {
    background: "#17120f",
    borderRight: "1px solid #f2c14e",
    borderBottom: "1px solid #f2c14e",
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.72rem",
    left: 0,
    letterSpacing: "0.08em",
    padding: "3px 6px",
    position: "absolute",
    top: 0,
  },
  editAvatarBtn: {
    background: "#382c23",
    border: "1px solid #f2c14e",
    color: "#fff8e7",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.85rem",
    letterSpacing: "0.08em",
    minHeight: "38px",
    padding: "6px 14px",
    textTransform: "uppercase",
  },
  fighterDetails: {
    display: "flex",
    flex: "1 1 300px",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  fighterHeaderRow: {
    alignItems: "flex-start",
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    justifyContent: "space-between",
    marginBottom: "16px",
  },
  displayName: {
    display: "block",
    fontFamily: "Impact, sans-serif",
    fontSize: "clamp(1.5rem, 5vw, 2.2rem)",
    letterSpacing: "0.04em",
    lineHeight: 1,
    textTransform: "uppercase",
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "8px",
  },
  rankBadge: {
    background: "#382318",
    border: "1px solid #f2c14e",
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.82rem",
    letterSpacing: "0.06em",
    padding: "3px 8px",
  },
  careerBadge: {
    background: "#1c261e",
    border: "1px solid #4ade80",
    color: "#86efac",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.82rem",
    letterSpacing: "0.06em",
    padding: "3px 8px",
  },
  levelBadge: {
    alignItems: "center",
    background: "#e23b2e",
    border: "2px solid #fff8e7",
    display: "flex",
    flexDirection: "column",
    minWidth: "68px",
    padding: "6px 10px",
  },
  levelLabel: {
    color: "#fff8e7",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.72rem",
    letterSpacing: "0.1em",
  },
  levelNumber: {
    color: "#ffffff",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.7rem",
    lineHeight: 1,
  },
  xpSection: {
    background: "#1a130e",
    border: "1px solid #4a382c",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "12px 14px",
  },
  xpHeader: {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    fontSize: "0.85rem",
    justifyContent: "space-between",
  },
  xpTitle: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    letterSpacing: "0.08em",
  },
  xpNumbers: {
    color: "#d8cbbb",
  },
  xpTrack: {
    background: "#0f0b08",
    border: "1px solid #5a4638",
    height: "14px",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  xpFill: {
    background: "linear-gradient(90deg, #f2c14e 0%, #e23b2e 100%)",
    height: "100%",
    transition: "width 0.3s ease-out",
  },
  xpFooter: {
    display: "flex",
    flexWrap: "wrap",
    fontSize: "0.78rem",
    justifyContent: "space-between",
  },
  xpRemaining: {
    color: "#a89b8d",
  },
  xpTotal: {
    color: "#786555",
  },
  sectionHeader: {
    alignItems: "baseline",
    borderBottom: "1px dashed #4a382c",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    justifyContent: "space-between",
    marginBottom: "16px",
    paddingBottom: "8px",
  },
  sectionTitle: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.3rem",
    letterSpacing: "0.06em",
    margin: 0,
    textTransform: "uppercase",
  },
  sectionSubtitle: {
    color: "#a89b8d",
    fontSize: "0.85rem",
  },
  statsGrid: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  },
  statBox: {
    alignItems: "center",
    background: "#18120e",
    border: "1px solid #4a382c",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "14px 10px",
    textAlign: "center",
  },
  statLabel: {
    color: "#a89b8d",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.75rem",
    letterSpacing: "0.08em",
  },
  statValue: {
    fontFamily: "Impact, sans-serif",
    fontSize: "1.8rem",
    lineHeight: 1,
  },
  statSub: {
    color: "#6e5d50",
    fontSize: "0.72rem",
  },
  achievementBadgeCounter: {
    background: "#382c23",
    border: "1px solid #f2c14e",
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.85rem",
    letterSpacing: "0.06em",
    padding: "4px 10px",
  },
  achievementsGrid: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  },
  achievementCard: {
    border: "2px solid #423226",
    boxSizing: "border-box",
    display: "flex",
    gap: "12px",
    padding: "14px",
  },
  achievementIconWrap: {
    alignItems: "center",
    border: "2px solid",
    borderRadius: "4px",
    display: "flex",
    height: "44px",
    justifyContent: "center",
    minWidth: "44px",
    width: "44px",
  },
  achievementIcon: {
    fontSize: "1.5rem",
  },
  achievementBody: {
    display: "flex",
    flex: 1,
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  achievementTitleRow: {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    justifyContent: "space-between",
  },
  achievementName: {
    fontFamily: "Impact, sans-serif",
    fontSize: "1.05rem",
    letterSpacing: "0.04em",
    margin: 0,
    textTransform: "uppercase",
  },
  achievementStatusTag: {
    border: "1px solid",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.68rem",
    letterSpacing: "0.06em",
    padding: "2px 5px",
  },
  achievementDesc: {
    fontSize: "0.82rem",
    lineHeight: 1.35,
    margin: 0,
  },
  unlocksSummaryRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },
  unlockMiniBadge: {
    alignItems: "center",
    background: "#18120e",
    border: "1px solid #4a382c",
    display: "flex",
    fontSize: "0.88rem",
    gap: "8px",
    padding: "8px 14px",
  },
  unlockMiniIcon: {
    fontSize: "1.2rem",
  },
  actionRow: {
    display: "flex",
    justifyContent: "center",
    marginTop: "8px",
  },
  playButton: {
    background: "#e23b2e",
    border: "2px solid #ad2e24",
    boxShadow: "4px 4px 0 #ad2e24",
    color: "#ffffff",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.25rem",
    letterSpacing: "0.08em",
    minHeight: "48px",
    padding: "14px 28px",
    textTransform: "uppercase",
    width: "100%",
  },
};

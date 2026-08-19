import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type {
  Client,
  LeaderboardRecord,
  Session,
} from "@heroiclabs/nakama-js";

const PAGE_SIZE = 20;

export const LEADERBOARDS = {
  most_kos: { label: "Más K.O.s", scoreLabel: "K.O.s" },
  current_streak: { label: "Racha actual", scoreLabel: "victorias" },
} as const;

export type LeaderboardId = keyof typeof LEADERBOARDS;

export interface LeaderboardsProps {
  client: Client;
  session: Session;
  onBack?: () => void;
}

interface PageState {
  records: ReadonlyArray<LeaderboardRecord>;
  nextCursor?: string;
  previousCursors: ReadonlyArray<string | undefined>;
}

const INITIAL_PAGE: PageState = { records: [], previousCursors: [] };

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("401") || message.toLowerCase().includes("unauthorized")
    ? "Tu sesión venció. Volvé a ingresar para ver el ranking."
    : "No pudimos cargar el ranking. Revisá tu conexión e intentá de nuevo.";
}

export function Leaderboards({ client, session, onBack }: LeaderboardsProps) {
  const [leaderboardId, setLeaderboardId] = useState<LeaderboardId>("most_kos");
  const [page, setPage] = useState<PageState>(INITIAL_PAGE);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (requestedCursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await client.listLeaderboardRecords(
          session,
          leaderboardId,
          undefined,
          PAGE_SIZE,
          requestedCursor,
        );
        setPage((current) => ({
          records: response.records ?? [],
          nextCursor: response.next_cursor,
          previousCursors: current.previousCursors,
        }));
      } catch (loadError: unknown) {
        setError(errorMessage(loadError));
      } finally {
        setLoading(false);
      }
    },
    [client, leaderboardId, session],
  );

  useEffect(() => {
    setCursor(undefined);
    setPage(INITIAL_PAGE);
    void loadPage(undefined);
  }, [leaderboardId]); // eslint-disable-line react-hooks/exhaustive-deps

  function showNextPage() {
    if (!page.nextCursor || loading) return;
    const nextCursor = page.nextCursor;
    setPage((current) => ({
      ...current,
      previousCursors: [...current.previousCursors, cursor],
    }));
    setCursor(nextCursor);
    void loadPage(nextCursor);
  }

  function showPreviousPage() {
    if (page.previousCursors.length === 0 || loading) return;
    const previousCursors = page.previousCursors.slice(0, -1);
    const previousCursor = page.previousCursors[page.previousCursors.length - 1];
    setPage((current) => ({ ...current, previousCursors }));
    setCursor(previousCursor);
    void loadPage(previousCursor);
  }

  const definition = LEADERBOARDS[leaderboardId];

  return (
    <main style={styles.page}>
      <section aria-labelledby="leaderboards-title" style={styles.card}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>SALÓN DE LA FAMA</p>
            <h1 id="leaderboards-title" style={styles.title}>Leaderboards</h1>
          </div>
          {onBack && <button type="button" onClick={onBack} style={styles.back}>Volver</button>}
        </header>

        <div role="tablist" aria-label="Elegí un leaderboard" style={styles.tabs}>
          {(Object.keys(LEADERBOARDS) as LeaderboardId[]).map((id) => (
            <button
              key={id}
              id={`${id}-tab`}
              type="button"
              role="tab"
              aria-selected={leaderboardId === id}
              aria-controls="leaderboard-panel"
              onClick={() => setLeaderboardId(id)}
              style={{ ...styles.tab, ...(leaderboardId === id ? styles.activeTab : {}) }}
            >
              {LEADERBOARDS[id].label}
            </button>
          ))}
        </div>

        <div
          id="leaderboard-panel"
          role="tabpanel"
          aria-labelledby={`${leaderboardId}-tab`}
          aria-busy={loading}
        >
          {loading && <p role="status" style={styles.message}>Cargando posiciones…</p>}
          {!loading && error && (
            <div role="alert" style={styles.message}>
              <p>{error}</p>
              <button type="button" onClick={() => void loadPage(cursor)} style={styles.action}>Reintentar</button>
            </div>
          )}
          {!loading && !error && page.records.length === 0 && (
            <p style={styles.message}>Todavía no hay peleadores en este ranking.</p>
          )}
          {!loading && !error && page.records.length > 0 && (
            <ol aria-label={definition.label} style={styles.list}>
              {page.records.map((record, index) => {
                const isCurrentUser = record.owner_id === session.user_id;
                const rank = record.rank ?? index + 1;
                return (
                  <li
                    key={record.owner_id ?? `${rank}-${index}`}
                    aria-current={isCurrentUser ? "true" : undefined}
                    style={{ ...styles.row, ...(isCurrentUser ? styles.currentUser : {}) }}
                  >
                    <strong style={styles.rank}>#{rank}</strong>
                    <span style={styles.username}>
                      {record.username || "Peleador anónimo"}
                      {isCurrentUser && <small style={styles.you}>Vos</small>}
                    </span>
                    <span style={styles.score}>{record.score ?? 0} {definition.scoreLabel}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <nav aria-label="Páginas del leaderboard" style={styles.pagination}>
          <button type="button" disabled={loading || page.previousCursors.length === 0} onClick={showPreviousPage} style={styles.action}>Anterior</button>
          <span>Página {page.previousCursors.length + 1}</span>
          <button type="button" disabled={loading || !page.nextCursor} onClick={showNextPage} style={styles.action}>Siguiente</button>
        </nav>
      </section>
    </main>
  );
}

const styles: Readonly<Record<string, CSSProperties>> = {
  page: { background: "#17120f", color: "#fff8e7", fontFamily: "Georgia, serif", minHeight: "100dvh", padding: "24px" },
  card: { margin: "0 auto", maxWidth: "760px" },
  header: { alignItems: "center", display: "flex", gap: "16px", justifyContent: "space-between" },
  eyebrow: { color: "#f2c14e", fontFamily: "Impact, sans-serif", letterSpacing: "0.16em", margin: "0 0 8px" },
  title: { fontSize: "clamp(2.4rem, 10vw, 4.5rem)", lineHeight: 0.95, margin: "0 0 24px", textTransform: "uppercase" },
  back: { background: "transparent", border: "2px solid #f2c14e", color: "#fff8e7", minHeight: "44px", padding: "8px 16px" },
  tabs: { display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: "20px" },
  tab: { background: "#241c17", border: "2px solid #6e5b4f", color: "#d8cbbb", fontSize: "1rem", fontWeight: 700, minHeight: "48px", padding: "10px" },
  activeTab: { background: "#e23b2e", borderColor: "#f2c14e", color: "#fff" },
  message: { background: "#241c17", border: "2px solid #6e5b4f", margin: 0, minHeight: "88px", padding: "24px", textAlign: "center" },
  list: { display: "grid", gap: "8px", listStyle: "none", margin: 0, padding: 0 },
  row: { alignItems: "center", background: "#241c17", borderLeft: "5px solid #6e5b4f", display: "grid", gap: "12px", gridTemplateColumns: "48px minmax(0, 1fr) auto", minHeight: "60px", padding: "8px 12px" },
  currentUser: { background: "#49311c", borderColor: "#f2c14e" },
  rank: { color: "#f2c14e", fontSize: "1.1rem" },
  username: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  you: { background: "#f2c14e", color: "#17120f", fontFamily: "sans-serif", fontWeight: 700, marginLeft: "8px", padding: "2px 5px", textTransform: "uppercase" },
  score: { fontVariantNumeric: "tabular-nums", fontWeight: 700, textAlign: "right" },
  pagination: { alignItems: "center", display: "flex", justifyContent: "space-between", marginTop: "20px" },
  action: { background: "#e23b2e", border: 0, color: "#fff", fontWeight: 700, minHeight: "44px", padding: "8px 16px" },
};

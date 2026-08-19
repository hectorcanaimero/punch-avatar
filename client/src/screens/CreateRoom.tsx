import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type {
  Client,
  MatchPresenceEvent,
  Session,
  Socket,
} from "@heroiclabs/nakama-js";

interface CreatedRoomPayload {
  code: string;
  matchId: string;
  expiresAt: number;
}

export type CreatedFriendlyRoom = CreatedRoomPayload;

type CreateRoomProps = {
  client: Client;
  session: Session;
  socket: Socket;
  onOpponentJoined: (room: CreatedFriendlyRoom) => void;
  onBack?: () => void;
};

type ScreenState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "waiting"; room: CreatedFriendlyRoom }
  | { status: "error"; message: string };

function errorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("AUTH_REQUIRED")) {
    return "Tu sesión venció. Volvé a iniciar sesión.";
  }
  if (raw.includes("ROOM_CODE_EXHAUSTED")) {
    return "No pudimos reservar un código. Probá de nuevo en unos segundos.";
  }
  return "No pudimos crear la sala. Revisá tu conexión e intentá de nuevo.";
}

function parseRoomPayload(payload: unknown): CreatedFriendlyRoom {
  const value = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as CreatedRoomPayload).code !== "string" ||
    typeof (value as CreatedRoomPayload).matchId !== "string" ||
    typeof (value as CreatedRoomPayload).expiresAt !== "number"
  ) {
    throw new Error("ROOM_RESPONSE_INVALID");
  }
  return value as CreatedFriendlyRoom;
}

export function CreateRoom({
  client,
  session,
  socket,
  onOpponentJoined,
  onBack,
}: CreateRoomProps) {
  const [state, setState] = useState<ScreenState>({ status: "idle" });
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const activeRoomRef = useRef<CreatedFriendlyRoom | null>(null);
  const opponentNotifiedRef = useRef(false);

  useEffect(() => {
    const previousHandler = socket.onmatchpresence;
    const presenceHandler = (event: MatchPresenceEvent) => {
      previousHandler?.(event);
      const room = activeRoomRef.current;
      if (!room || event.match_id !== room.matchId) return;

      const opponentJoined = event.joins.some(
        (presence) => presence.user_id !== session.user_id,
      );
      if (opponentJoined && !opponentNotifiedRef.current) {
        opponentNotifiedRef.current = true;
        onOpponentJoined(room);
      }
    };

    socket.onmatchpresence = presenceHandler;
    return () => {
      // WHY: Socket tiene un único callback mutable; no pisamos un handler que
      // otra pantalla haya instalado después que esta.
      if (socket.onmatchpresence === presenceHandler) {
        socket.onmatchpresence = previousHandler;
      }
    };
  }, [onOpponentJoined, session.user_id, socket]);

  async function createRoom() {
    if (state.status === "creating" || state.status === "waiting") return;

    setState({ status: "creating" });
    setCopyFeedback(null);
    opponentNotifiedRef.current = false;
    try {
      const response = await client.rpc(session, "create_friendly_room", {});
      const room = parseRoomPayload(response.payload);
      const match = await socket.joinMatch(room.matchId);
      activeRoomRef.current = room;
      setState({ status: "waiting", room });

      const opponentPresent = match.presences.some(
        (presence) => presence.user_id !== session.user_id,
      );
      if (opponentPresent && !opponentNotifiedRef.current) {
        opponentNotifiedRef.current = true;
        onOpponentJoined(room);
      }
    } catch (error: unknown) {
      activeRoomRef.current = null;
      setState({ status: "error", message: errorText(error) });
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopyFeedback("Código copiado. Mandáselo a tu rival.");
    } catch {
      setCopyFeedback("No pudimos copiarlo. Mantené apretado el código para seleccionarlo.");
    }
  }

  const waitingRoom = state.status === "waiting" ? state.room : null;

  return (
    <main style={styles.page}>
      <section aria-labelledby="create-room-title" style={styles.card}>
        <p style={styles.eyebrow}>VERSUS AMISTOSO</p>
        <h1 id="create-room-title" style={styles.title}>
          Creá tu sala
        </h1>

        {waitingRoom ? (
          <>
            <p style={styles.copy}>Compartí este código con tu rival:</p>
            <button
              aria-label={`Copiar código de sala ${waitingRoom.code}`}
              onClick={() => void copyCode(waitingRoom.code)}
              style={styles.codeButton}
              type="button"
            >
              {waitingRoom.code}
            </button>
            <p aria-live="polite" style={styles.feedback}>
              {copyFeedback ?? "Tocá el código para copiarlo."}
            </p>
            <div aria-live="polite" role="status" style={styles.waitingBox}>
              <span aria-hidden="true" style={styles.pulse} />
              <strong>Esperando rival…</strong>
              <span>La pelea arranca cuando se una.</span>
            </div>
          </>
        ) : (
          <>
            <p style={styles.copy}>
              Abrí un ring privado y pasale el código a quien quieras desafiar.
            </p>
            {state.status === "error" ? (
              <p aria-live="assertive" role="alert" style={styles.error}>
                {state.message}
              </p>
            ) : null}
            <button
              disabled={state.status === "creating"}
              onClick={() => void createRoom()}
              style={{
                ...styles.primaryButton,
                opacity: state.status === "creating" ? 0.55 : 1,
              }}
              type="button"
            >
              {state.status === "creating" ? "Armando el ring…" : "Crear sala"}
            </button>
          </>
        )}

        {onBack ? (
          <button
            disabled={state.status === "creating"}
            onClick={onBack}
            style={styles.linkButton}
            type="button"
          >
            ← Volver
          </button>
        ) : null}
      </section>
    </main>
  );
}

const styles: Readonly<Record<string, CSSProperties>> = {
  page: {
    alignItems: "center",
    background: "#17120f",
    color: "#fff8e7",
    display: "flex",
    fontFamily: "Georgia, serif",
    justifyContent: "center",
    minHeight: "100dvh",
    padding: "24px",
  },
  card: {
    background: "#241c17",
    border: "3px solid #f2c14e",
    boxShadow: "10px 10px 0 #ad2e24",
    maxWidth: "440px",
    padding: "clamp(24px, 7vw, 48px)",
    textAlign: "center",
    width: "100%",
  },
  eyebrow: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    letterSpacing: "0.16em",
    margin: "0 0 12px",
  },
  title: {
    fontSize: "clamp(2.2rem, 10vw, 4rem)",
    lineHeight: 0.94,
    margin: "0 0 20px",
    textTransform: "uppercase",
  },
  copy: { color: "#d8cbbb", lineHeight: 1.55, margin: "0 0 28px" },
  primaryButton: {
    background: "#e23b2e",
    border: 0,
    color: "white",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.2rem",
    letterSpacing: "0.08em",
    minHeight: "48px",
    padding: "12px 20px",
    textTransform: "uppercase",
    width: "100%",
  },
  codeButton: {
    background: "#fff8e7",
    border: "4px solid #e23b2e",
    color: "#17120f",
    cursor: "copy",
    fontFamily: "'Courier New', monospace",
    fontSize: "clamp(2rem, 13vw, 3.8rem)",
    fontWeight: 900,
    letterSpacing: "0.12em",
    minHeight: "72px",
    overflowWrap: "anywhere",
    padding: "12px 8px",
    width: "100%",
  },
  feedback: { color: "#f2c14e", minHeight: "44px", margin: "8px 0" },
  error: { color: "#ff8a80", lineHeight: 1.45, margin: "0 0 20px" },
  waitingBox: {
    alignItems: "center",
    background: "#17120f",
    border: "2px solid #5f5147",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minHeight: "96px",
    padding: "18px",
  },
  pulse: {
    background: "#f2c14e",
    borderRadius: "50%",
    boxShadow: "0 0 0 6px rgba(242, 193, 78, 0.18)",
    height: "12px",
    width: "12px",
  },
  linkButton: {
    background: "transparent",
    border: 0,
    color: "#f2c14e",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.95rem",
    letterSpacing: "0.08em",
    marginTop: "12px",
    minHeight: "44px",
    padding: "8px 12px",
    textTransform: "uppercase",
    width: "100%",
  },
};

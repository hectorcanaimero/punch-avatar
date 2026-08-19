import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import type { Client, Session } from "@heroiclabs/nakama-js";

import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCode,
} from "../../../src/lib/room-code";

const ALLOWED_CHAR_SET = new Set(ROOM_CODE_ALPHABET.split(""));

// Errores server-side de join_friendly_room (T-027) mapeados a copy amigable.
const SERVER_ERROR_COPY: Readonly<Record<string, string>> = {
  ROOM_NOT_FOUND: "Ese código no existe o expiró.",
  ROOM_EXPIRED: "Ese código expiró. Pedile al host uno nuevo.",
  MATCH_NOT_AVAILABLE: "La sala ya se cerró.",
  CODE_INVALID: "Código inválido. 6 caracteres, sin 0/O/1/I.",
  CODE_REQUIRED: "Ingresá el código de la sala.",
  AUTH_REQUIRED: "Sesión inválida. Volvé a iniciar sesión.",
};

export interface JoinedRoom {
  matchId: string;
  code: string;
  hostUserId: string;
}

type JoinRoomProps = {
  client: Client;
  session: Session;
  onJoined: (room: JoinedRoom) => void;
  onBack?: () => void;
};

function extractServerError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  for (const key of Object.keys(SERVER_ERROR_COPY)) {
    if (raw.includes(key)) return SERVER_ERROR_COPY[key];
  }
  return "No pudimos unirte. Revisá el código y probá de nuevo.";
}

/**
 * WHY: filtramos char por char en vez de solo uppercase-en-submit para que el
 * jugador no pueda ni siquiera tipear 0/O/1/I ni lowercase. Feedback inmediato.
 */
function sanitizeInput(raw: string): string {
  const upper = raw.toUpperCase();
  let out = "";
  for (const ch of upper) {
    if (ALLOWED_CHAR_SET.has(ch) && out.length < ROOM_CODE_LENGTH) out += ch;
  }
  return out;
}

export function JoinRoom({ client, session, onJoined, onBack }: JoinRoomProps) {
  const [code, setCode] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const valid = useMemo(() => isValidRoomCode(code), [code]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || submitting) return;

    setSubmitting(true);
    setServerError(null);
    try {
      const response = await client.rpc(session, "join_friendly_room", {
        code,
      });
      const payload =
        typeof response.payload === "string"
          ? (JSON.parse(response.payload) as JoinedRoom)
          : (response.payload as unknown as JoinedRoom);
      onJoined(payload);
    } catch (error: unknown) {
      setServerError(extractServerError(error));
      setSubmitting(false);
    }
  }

  const feedbackId = "join-room-feedback";
  const helperText =
    serverError ?? `6 caracteres. Alfabeto sin 0/O/1/I.`;

  return (
    <main style={styles.page}>
      <section aria-labelledby="join-title" style={styles.card}>
        <p style={styles.eyebrow}>PUNCH AVATAR</p>
        <h1 id="join-title" style={styles.title}>
          Unirte a una sala
        </h1>
        <p style={styles.copy}>
          Pediíle el código al host y meteselo abajo.
        </p>

        <form onSubmit={submit} noValidate>
          <label htmlFor="room-code" style={styles.label}>
            Código de sala
          </label>
          <input
            id="room-code"
            name="room-code"
            type="text"
            value={code}
            onChange={(event) => {
              setCode(sanitizeInput(event.target.value));
              setServerError(null);
            }}
            aria-describedby={feedbackId}
            aria-invalid={Boolean(serverError)}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            maxLength={ROOM_CODE_LENGTH}
            placeholder="XXXXXX"
            disabled={submitting}
            style={styles.input}
          />
          <p id={feedbackId} aria-live="polite" style={styles.feedback}>
            {helperText}
          </p>
          <button
            type="submit"
            disabled={!valid || submitting}
            style={{
              ...styles.button,
              opacity: !valid || submitting ? 0.55 : 1,
            }}
          >
            {submitting ? "Uniéndote…" : "Entrar"}
          </button>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              disabled={submitting}
              style={styles.linkButton}
            >
              ← Volver
            </button>
          ) : null}
        </form>
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
    width: "100%",
  },
  eyebrow: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    letterSpacing: "0.16em",
    margin: "0 0 12px",
  },
  title: {
    fontSize: "clamp(2rem, 8vw, 3.4rem)",
    lineHeight: 0.94,
    margin: "0 0 20px",
    textTransform: "uppercase",
  },
  copy: { color: "#d8cbbb", lineHeight: 1.55, margin: "0 0 32px" },
  label: { display: "block", fontWeight: 700, marginBottom: "8px" },
  input: {
    background: "#fff8e7",
    border: "3px solid transparent",
    borderRadius: 0,
    boxSizing: "border-box",
    color: "#17120f",
    fontFamily: "'Courier New', monospace",
    fontSize: "2rem",
    letterSpacing: "0.4em",
    minHeight: "60px",
    padding: "12px",
    textAlign: "center",
    textTransform: "uppercase",
    width: "100%",
  },
  feedback: { color: "#f2c14e", minHeight: "44px", margin: "8px 0" },
  button: {
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
  linkButton: {
    background: "transparent",
    border: 0,
    color: "#f2c14e",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.95rem",
    letterSpacing: "0.08em",
    marginTop: "12px",
    padding: "8px 12px",
    textTransform: "uppercase",
    width: "100%",
  },
};

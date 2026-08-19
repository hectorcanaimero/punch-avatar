import { useState, type CSSProperties, type FormEvent } from "react";
import type { Client, Session } from "@heroiclabs/nakama-js";

import { validateUsername } from "../../../src/lib/username";

const SESSION_STORAGE_KEY = "punch.sessionToken";

const VALIDATION_MESSAGES: Readonly<Record<string, string>> = {
  too_short: "Usá al menos 3 caracteres.",
  too_long: "Usá como máximo 20 caracteres.",
  invalid_chars: "Solo se permiten letras y números.",
  reserved: "Ese nombre está reservado.",
};

type RegisterProps = {
  client: Client;
  onRegistered: (session: Session) => void;
};

function errorText(error: unknown): string {
  const serialized = error instanceof Error ? error.message : JSON.stringify(error);
  return serialized.includes("USERNAME_TAKEN")
    ? "Ese username ya está en uso. Probá con otro."
    : "No pudimos crear tu perfil. Revisá tu conexión e intentá de nuevo.";
}

export function Register({ client, onRegistered }: RegisterProps) {
  const [username, setUsername] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const normalizedUsername = username.trim();
  const validation = validateUsername(normalizedUsername);
  const validationMessage =
    normalizedUsername.length === 0 || validation.valid
      ? null
      : VALIDATION_MESSAGES[validation.reason];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validation.valid || submitting) return;

    setSubmitting(true);
    setServerError(null);

    try {
      const session = await client.authenticateCustom(
        normalizedUsername,
        true,
        normalizedUsername,
      );
      await client.rpc(session, "register_profile", {
        username: normalizedUsername,
      });
      localStorage.setItem(SESSION_STORAGE_KEY, session.token);
      onRegistered(session);
    } catch (error: unknown) {
      setServerError(errorText(error));
    } finally {
      setSubmitting(false);
    }
  }

  const feedbackId = "register-feedback";

  return (
    <main style={styles.page}>
      <section aria-labelledby="register-title" style={styles.card}>
        <p style={styles.eyebrow}>PUNCH AVATAR</p>
        <h1 id="register-title" style={styles.title}>
          Elegí tu nombre de ring
        </h1>
        <p style={styles.copy}>
          Va a ser tu identidad permanente. Guardalo: en esta versión no hay
          recuperación de cuenta.
        </p>

        <form onSubmit={submit} noValidate>
          <label htmlFor="username" style={styles.label}>
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setServerError(null);
            }}
            aria-describedby={feedbackId}
            aria-invalid={Boolean(validationMessage || serverError)}
            autoComplete="username"
            autoCapitalize="none"
            maxLength={20}
            placeholder="ej. Golpeador77"
            disabled={submitting}
            style={styles.input}
          />
          <p id={feedbackId} aria-live="polite" style={styles.feedback}>
            {serverError ?? validationMessage ?? "3–20 caracteres, solo letras y números."}
          </p>
          <button
            type="submit"
            disabled={!validation.valid || submitting}
            style={{
              ...styles.button,
              opacity: !validation.valid || submitting ? 0.55 : 1,
            }}
          >
            {submitting ? "Creando perfil…" : "Empezar"}
          </button>
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
    fontSize: "clamp(2.2rem, 10vw, 4rem)",
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
    fontSize: "1rem",
    minHeight: "48px",
    padding: "12px",
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
};

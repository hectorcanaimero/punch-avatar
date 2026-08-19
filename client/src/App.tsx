import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Client, Session, type Socket } from "@heroiclabs/nakama-js";

import type { MatchStateView } from "../../shared/types";
import { AvatarStudio } from "./screens/AvatarStudio";
import { CareerLadder } from "./screens/CareerLadder";
import { Combat } from "./screens/Combat";
import { CreateRoom } from "./screens/CreateRoom";
import { JoinRoom } from "./screens/JoinRoom";
import { Leaderboards } from "./screens/Leaderboards";
import { Profile } from "./screens/Profile";
import { RankedSearch } from "./screens/RankedSearch";
import { Register } from "./screens/Register";

// ---------- Nakama client init ----------

// WHY: expuestos por Vite via import.meta.env con fallback local. Playtest
// remoto pisa con VITE_NAKAMA_HOST/PORT en un .env.local o var de entorno.
const NAKAMA_HOST =
  (import.meta.env.VITE_NAKAMA_HOST as string | undefined) ?? "127.0.0.1";
const NAKAMA_PORT =
  (import.meta.env.VITE_NAKAMA_PORT as string | undefined) ?? "7350";
const NAKAMA_SSL =
  (import.meta.env.VITE_NAKAMA_SSL as string | undefined) === "true";
const SERVER_KEY =
  (import.meta.env.VITE_NAKAMA_SERVER_KEY as string | undefined) ??
  "defaultkey";

const SESSION_STORAGE_KEY = "punch:session:v1";

const nakama = new Client(SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT, NAKAMA_SSL);

// ---------- Session persistence ----------

function restoreSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token: string; refresh: string };
    const session = Session.restore(parsed.token, parsed.refresh);
    if (session.isexpired(Date.now() / 1000)) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function persistSession(session: Session): void {
  window.localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ token: session.token, refresh: session.refresh_token }),
  );
}

// ---------- Screen state machine ----------

type Screen =
  | "register"
  | "menu"
  | "career"
  | "create-room"
  | "join-room"
  | "ranked"
  | "profile"
  | "leaderboards"
  | "avatar"
  | "combat-preview";

export function App() {
  const [session, setSession] = useState<Session | null>(() => restoreSession());
  const [screen, setScreen] = useState<Screen>(() =>
    restoreSession() ? "menu" : "register",
  );
  const socketRef = useRef<Socket | null>(null);
  const [socketReady, setSocketReady] = useState(false);

  // WHY: creamos y conectamos el socket una vez por sesión. CreateRoom lo
  // exige (matchmaker + presence events). Otras pantallas lo usan opcional.
  useEffect(() => {
    if (!session) {
      setSocketReady(false);
      return;
    }
    const s = nakama.createSocket(NAKAMA_SSL, false);
    socketRef.current = s;
    let cancelled = false;
    s.connect(session, true)
      .then(() => {
        if (!cancelled) setSocketReady(true);
      })
      .catch((err) => {
        console.error("socket connect failed:", err);
      });
    return () => {
      cancelled = true;
      try {
        s.disconnect(false);
      } catch {
        /* noop */
      }
      socketRef.current = null;
      setSocketReady(false);
    };
  }, [session]);

  function handleRegistered(next: Session): void {
    persistSession(next);
    setSession(next);
    setScreen("menu");
  }

  function handleLogout(): void {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setScreen("register");
  }

  if (!session || screen === "register") {
    return <Register client={nakama} onRegistered={handleRegistered} />;
  }

  const back = (): void => setScreen("menu");
  const goCombat = (): void => setScreen("combat-preview");

  switch (screen) {
    case "menu":
      return (
        <MainMenu
          session={session}
          onSelect={setScreen}
          onLogout={handleLogout}
        />
      );
    case "career":
      return (
        <CareerLadder
          client={nakama}
          session={session}
          onBack={back}
          onStartMatch={goCombat}
        />
      );
    case "create-room":
      if (!socketReady || !socketRef.current) {
        return <Connecting onBack={back} />;
      }
      return (
        <CreateRoom
          client={nakama}
          session={session}
          socket={socketRef.current}
          onBack={back}
          onOpponentJoined={goCombat}
        />
      );
    case "join-room":
      return (
        <JoinRoom
          client={nakama}
          session={session}
          onBack={back}
          onJoined={goCombat}
        />
      );
    case "ranked":
      return (
        <RankedSearch
          rankScore={1000}
          onBack={back}
          onMatchFound={goCombat}
          onPlayBot={goCombat}
        />
      );
    case "profile":
      return (
        <Profile
          client={nakama}
          session={session}
          userId={session.user_id}
          onBack={back}
          onEditAvatar={() => setScreen("avatar")}
          onPlayMatch={() => setScreen("menu")}
        />
      );
    case "leaderboards":
      return <Leaderboards client={nakama} session={session} onBack={back} />;
    case "avatar":
      return (
        <AvatarStudio
          client={nakama}
          session={session}
          onAvatarSaved={back}
          onBack={back}
        />
      );
    case "combat-preview":
      return <CombatPreview session={session} onBack={back} />;
    default:
      return <div style={fallbackStyle}>Pantalla desconocida: {screen}</div>;
  }
}

// ---------- Main menu ----------

interface MenuProps {
  session: Session;
  onSelect: (s: Screen) => void;
  onLogout: () => void;
}

function MainMenu({ session, onSelect, onLogout }: MenuProps) {
  const username = session.username ?? "boxer";
  return (
    <main style={menuStyles.page}>
      <div style={menuStyles.card}>
        <p style={menuStyles.eyebrow}>PUNCH AVATAR</p>
        <h1 style={menuStyles.title}>Al ring, {username}</h1>
        <div style={menuStyles.grid}>
          <MenuButton label="Carrera PvE" onClick={() => onSelect("career")} accent="#e23b2e" />
          <MenuButton label="Ranked" onClick={() => onSelect("ranked")} accent="#f2c14e" />
          <MenuButton label="Crear sala" onClick={() => onSelect("create-room")} accent="#4a8f3a" />
          <MenuButton label="Unirse" onClick={() => onSelect("join-room")} accent="#4a8f3a" />
          <MenuButton label="Perfil" onClick={() => onSelect("profile")} accent="#2b6cb0" />
          <MenuButton label="Leaderboards" onClick={() => onSelect("leaderboards")} accent="#2b6cb0" />
          <MenuButton label="Cambiar avatar" onClick={() => onSelect("avatar")} accent="#8e44ad" />
          <MenuButton label="Ver combat (preview)" onClick={() => onSelect("combat-preview")} accent="#555" />
        </div>
        <button type="button" onClick={onLogout} style={menuStyles.logout}>
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}

interface MenuButtonProps {
  label: string;
  onClick: () => void;
  accent: string;
}

function MenuButton({ label, onClick, accent }: MenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...menuStyles.button, background: accent }}
    >
      {label}
    </button>
  );
}

// ---------- Combat preview (mock state, no socket integration yet) ----------

interface CombatPreviewProps {
  session: Session;
  onBack: () => void;
}

function CombatPreview({ session, onBack }: CombatPreviewProps) {
  // WHY: shell no wirea todavía matchJoin + socket + tick handling. Pasamos un
  // MatchStateView estático para que la UI renderice y el playtester vea el
  // ring, HUD, guantes y avatares. Live socket es task de integración aparte.
  const mockState: MatchStateView = useMemo(
    () => ({
      tick: 0,
      status: "active",
      winner: null,
      players: {
        [session.user_id ?? "player"]: {
          userId: session.user_id ?? "player",
          avatarUrl: "",
          health: 100,
          blocking: false,
          blockSide: null,
          charge: 40,
          stance: "idle",
        },
        rival: {
          userId: "rival",
          avatarUrl: "/assets/rivals/tito-cucharon.webp",
          health: 80,
          blocking: false,
          blockSide: null,
          charge: 10,
          stance: "idle",
        },
      },
    }),
    [session.user_id],
  );

  return (
    <div style={{ position: "relative", minHeight: "100dvh" }}>
      <Combat
        state={mockState}
        playerId={session.user_id ?? "player"}
        playerName={session.username ?? "vos"}
        rivalName="Tito Cucharón"
      />
      <div style={combatPreviewStyles.banner}>
        <span>⚠ PREVIEW — sin sync al servidor</span>
        <button type="button" onClick={onBack} style={combatPreviewStyles.backBtn}>
          ← Volver al menú
        </button>
      </div>
    </div>
  );
}

// ---------- Styles ----------

const menuStyles: Record<string, CSSProperties> = {
  page: {
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
    minHeight: "100dvh",
    padding: "24px",
  },
  card: {
    background: "#241c17",
    border: "3px solid #f2c14e",
    boxShadow: "10px 10px 0 #ad2e24",
    maxWidth: "520px",
    padding: "clamp(24px, 6vw, 44px)",
    width: "100%",
  },
  eyebrow: {
    color: "#f2c14e",
    fontFamily: "Impact, sans-serif",
    letterSpacing: "0.16em",
    margin: "0 0 12px",
  },
  title: {
    fontSize: "clamp(1.8rem, 6vw, 2.8rem)",
    lineHeight: 1.05,
    margin: "0 0 24px",
    textTransform: "uppercase",
  },
  grid: {
    display: "grid",
    gap: "10px",
    gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
  },
  button: {
    border: 0,
    color: "#fff",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "1.05rem",
    letterSpacing: "0.06em",
    minHeight: "56px",
    padding: "14px 18px",
    textTransform: "uppercase",
    width: "100%",
  },
  logout: {
    background: "transparent",
    border: 0,
    color: "#f2c14e",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.9rem",
    letterSpacing: "0.06em",
    marginTop: "24px",
    padding: "8px",
    textTransform: "uppercase",
    width: "100%",
  },
};

const combatPreviewStyles: Record<string, CSSProperties> = {
  banner: {
    alignItems: "center",
    background: "rgba(23, 18, 15, 0.92)",
    color: "#f2c14e",
    display: "flex",
    fontFamily: "Impact, sans-serif",
    gap: "16px",
    justifyContent: "space-between",
    left: 0,
    letterSpacing: "0.06em",
    padding: "8px 16px",
    position: "absolute",
    right: 0,
    textTransform: "uppercase",
    top: 0,
    zIndex: 10,
  },
  backBtn: {
    background: "#e23b2e",
    border: 0,
    color: "#fff",
    cursor: "pointer",
    fontFamily: "Impact, sans-serif",
    fontSize: "0.9rem",
    letterSpacing: "0.06em",
    padding: "8px 16px",
    textTransform: "uppercase",
  },
};

const fallbackStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  fontFamily: "Georgia, serif",
  justifyContent: "center",
  minHeight: "100dvh",
};

function Connecting({ onBack }: { onBack: () => void }) {
  return (
    <main style={fallbackStyle}>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#f2c14e", fontFamily: "Impact, sans-serif" }}>
          CONECTANDO AL SERVIDOR…
        </p>
        <button
          type="button"
          onClick={onBack}
          style={menuStyles.logout}
        >
          ← Volver
        </button>
      </div>
    </main>
  );
}

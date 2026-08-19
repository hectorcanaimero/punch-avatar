import { validateUsername } from "../lib/username";

const PROFILES_COLLECTION = "profiles";
const PROFILE_KEY = "profile";
const DEFAULT_RANK_SCORE = 1000;

export type Profile = {
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
};

function defaultProfile(displayName: string): Profile {
  return {
    displayName,
    avatarUrl: null,
    avatarStyle: null,
    level: 1,
    xp: 0,
    wins: 0,
    losses: 0,
    kos: 0,
    rankScore: DEFAULT_RANK_SCORE,
    careerProgress: 0,
    unlocks: [],
  };
}

export function parseRegisterPayload(raw: string | undefined): { username: string } {
  if (!raw) throw new Error("PAYLOAD_REQUIRED");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("PAYLOAD_INVALID_JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("PAYLOAD_INVALID");
  }
  const username = (parsed as { username?: unknown }).username;
  if (typeof username !== "string" || username.trim() === "") {
    throw new Error("USERNAME_REQUIRED");
  }
  return { username: username.trim() };
}

export const registerProfileRpc: nkruntime.RpcFunction = (
  _ctx,
  logger,
  nk,
  payload
): string => {
  const { username } = parseRegisterPayload(payload);

  const validation = validateUsername(username);
  if (!validation.valid) {
    throw new Error(`USERNAME_INVALID:${validation.reason}`);
  }

  // authenticateCustom es idempotente sobre customId: si `username` ya fue
  // reclamado, devuelve el mismo userId con `created=false`.
  const auth = nk.authenticateCustom(username, username, true);

  // `created=false` puede ser username-taken o auth huérfano (crash entre
  // authenticateCustom y storageWrite en un intento previo). Confirmamos
  // con lectura del perfil para distinguir los dos casos.
  if (!auth.created) {
    const existing = nk.storageRead([
      {
        collection: PROFILES_COLLECTION,
        key: PROFILE_KEY,
        userId: auth.userId,
      },
    ]);
    if (existing.length > 0) {
      throw new Error("USERNAME_TAKEN");
    }
    logger.warn(`recovering orphan auth for username=${username}`);
  }

  const profile = defaultProfile(username);
  nk.storageWrite([
    {
      collection: PROFILES_COLLECTION,
      key: PROFILE_KEY,
      userId: auth.userId,
      value: profile,
      // WHY: read=2 (public) porque leaderboards y perfiles ajenos lo consultan;
      // write=0 (server-only) para prevenir tampering desde el cliente.
      permissionRead: 2,
      permissionWrite: 0,
    },
  ]);

  logger.info(`registered profile: userId=${auth.userId} username=${username}`);

  return JSON.stringify({
    userId: auth.userId,
    username,
    profile,
  });
};

import { generateRoomCode } from "../lib/room-code";

const ROOMS_COLLECTION = "rooms";
const ROOM_TTL_MS = 15 * 60 * 1000; // 15 min
const MAX_CODE_ATTEMPTS = 10;

// WHY: Nakama storage siempre particiona por userId. Usamos un userId sentinel
// para que join_friendly_room pueda leer cualquier room solo con el código,
// sin conocer el userId del creador. permissionRead=2 (público) habilita eso.
const ROOMS_SYSTEM_USER_ID = "system";

export interface FriendlyRoomRecord {
  code: string;
  matchId: string;
  hostUserId: string;
  createdAt: string;
  expiresAt: number;
}

function isCodeTaken(nk: nkruntime.Nakama, code: string): boolean {
  try {
    const objs = nk.storageRead([
      { collection: ROOMS_COLLECTION, key: code, userId: ROOMS_SYSTEM_USER_ID },
    ]);
    return objs.length > 0;
  } catch {
    // WHY: storageRead lanza en not-found; ausencia ⇒ código libre.
    return false;
  }
}

export const createFriendlyRoomRpc: nkruntime.RpcFunction = (
  ctx,
  logger,
  nk,
  _payload
): string => {
  if (!ctx.userId) throw new Error("AUTH_REQUIRED");
  const hostUserId = ctx.userId;

  let code = "";
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const candidate = generateRoomCode();
    if (!isCodeTaken(nk, candidate)) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new Error("ROOM_CODE_EXHAUSTED");

  const matchId = nk.matchCreate("combat", { mode: "friendly", code });

  const now = Date.now();
  const record: FriendlyRoomRecord = {
    code,
    matchId,
    hostUserId,
    createdAt: new Date(now).toISOString(),
    expiresAt: now + ROOM_TTL_MS,
  };

  nk.storageWrite([
    {
      collection: ROOMS_COLLECTION,
      key: code,
      userId: ROOMS_SYSTEM_USER_ID,
      value: record,
      permissionRead: 2,
      permissionWrite: 0,
    },
  ]);

  logger.info(
    `create_friendly_room: code=${code} matchId=${matchId} host=${hostUserId}`
  );

  return JSON.stringify({
    code,
    matchId,
    expiresAt: record.expiresAt,
  });
};

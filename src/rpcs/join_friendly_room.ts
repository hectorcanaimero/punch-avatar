import { normalizeRoomCode } from "../lib/room-code.ts";

const ROOMS_COLLECTION = "rooms";
// WHY: sync con create_friendly_room.ts — null-UUID como sentinel de storage
// global (Nakama valida userId como UUID; "system" era rechazado en runtime).
const ROOMS_SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

interface JoinFriendlyRoomRequest {
  code?: string;
}

interface FriendlyRoomRecord {
  code: string;
  matchId: string;
  hostUserId: string;
  createdAt: string;
  expiresAt: number;
}

interface JoinFriendlyRoomResponse {
  matchId: string;
  code: string;
  hostUserId: string;
}

export function parseJoinPayload(
  raw: string | undefined
): { code: string } {
  if (!raw || raw.trim() === "") throw new Error("PAYLOAD_REQUIRED");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("PAYLOAD_INVALID_JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("PAYLOAD_INVALID");
  }
  const raw_code = (parsed as JoinFriendlyRoomRequest).code;
  if (typeof raw_code !== "string" || raw_code.trim() === "") {
    throw new Error("CODE_REQUIRED");
  }
  const normalized = normalizeRoomCode(raw_code);
  if (!normalized) throw new Error("CODE_INVALID");
  return { code: normalized };
}

export const joinFriendlyRoomRpc: nkruntime.RpcFunction = (
  ctx,
  logger,
  nk,
  payload
): string => {
  if (!ctx.userId) throw new Error("AUTH_REQUIRED");
  const { code } = parseJoinPayload(payload);

  let record: FriendlyRoomRecord;
  try {
    const objs = nk.storageRead([
      {
        collection: ROOMS_COLLECTION,
        key: code,
        userId: ROOMS_SYSTEM_USER_ID,
      },
    ]);
    if (objs.length === 0) throw new Error("ROOM_NOT_FOUND");
    record = objs[0].value as FriendlyRoomRecord;
  } catch (err) {
    // WHY: storageRead lanza en not-found; degradamos a ROOM_NOT_FOUND unificado.
    const msg = (err as Error).message ?? "";
    if (msg === "ROOM_NOT_FOUND") throw err;
    logger.warn(`join_friendly_room: storage read ${code} failed: ${msg}`);
    throw new Error("ROOM_NOT_FOUND");
  }

  if (record.expiresAt <= Date.now()) {
    throw new Error("ROOM_EXPIRED");
  }

  // WHY: validamos que el match sigue vivo. Si el host cerró antes de que llegara
  // el guest, matchGet devuelve null y no queremos mandarlo a un match muerto.
  const match = nk.matchGet(record.matchId);
  if (!match) {
    throw new Error("MATCH_NOT_AVAILABLE");
  }
  if (match.size >= 2) {
    throw new Error("ROOM_FULL");
  }

  const response: JoinFriendlyRoomResponse = {
    matchId: record.matchId,
    code: record.code,
    hostUserId: record.hostUserId,
  };
  logger.info(
    `join_friendly_room: code=${code} matchId=${record.matchId} guest=${ctx.userId}`
  );
  return JSON.stringify(response);
};

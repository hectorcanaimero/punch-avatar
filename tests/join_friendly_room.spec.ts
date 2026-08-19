import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  joinFriendlyRoomRpc,
  parseJoinPayload,
} from "../src/rpcs/join_friendly_room.ts";

const VALID_CODE = "ABC234";

function roomRecord(overrides: Record<string, unknown> = {}) {
  return {
    code: VALID_CODE,
    matchId: "match-1",
    hostUserId: "host-1",
    createdAt: "2026-08-19T00:00:00.000Z",
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

function callRpc(options: {
  userId?: string;
  record?: ReturnType<typeof roomRecord> | null;
  match?: { matchId: string; authoritative: boolean; size: number; label: string } | null;
  payload?: string;
} = {}): string {
  const record = options.record === undefined ? roomRecord() : options.record;
  const match = options.match === undefined
    ? { matchId: "match-1", authoritative: true, size: 1, label: "" }
    : options.match;
  const nk = {
    storageRead: () => record === null ? [] : [{ value: record }],
    matchGet: () => match,
  } as unknown as nkruntime.Nakama;
  const logger = {
    info: () => undefined,
    warn: () => undefined,
  } as unknown as nkruntime.Logger;

  return joinFriendlyRoomRpc(
    { userId: options.userId ?? "guest-1" } as nkruntime.Context,
    logger,
    nk,
    options.payload ?? JSON.stringify({ code: VALID_CODE }),
  );
}

describe("parseJoinPayload", () => {
  test("normaliza un código válido", () => {
    assert.deepEqual(parseJoinPayload('{"code":" abc234 "}'), { code: VALID_CODE });
  });

  test("rechaza payload y código inválidos", () => {
    assert.throws(() => parseJoinPayload(undefined), /PAYLOAD_REQUIRED/);
    assert.throws(() => parseJoinPayload("{"), /PAYLOAD_INVALID_JSON/);
    assert.throws(() => parseJoinPayload("[]"), /CODE_REQUIRED/);
    assert.throws(() => parseJoinPayload('{"code":"AB0OI1"}'), /CODE_INVALID/);
  });
});

describe("joinFriendlyRoomRpc", () => {
  test("retorna los datos de una sala disponible", () => {
    assert.deepEqual(JSON.parse(callRpc()), {
      matchId: "match-1",
      code: VALID_CODE,
      hostUserId: "host-1",
    });
  });

  test("rechaza una sala inexistente", () => {
    assert.throws(() => callRpc({ record: null }), /ROOM_NOT_FOUND/);
  });

  test("rechaza una sala expirada", () => {
    assert.throws(
      () => callRpc({ record: roomRecord({ expiresAt: Date.now() - 1 }) }),
      /ROOM_EXPIRED/,
    );
  });

  test("rechaza un match cerrado o lleno", () => {
    assert.throws(() => callRpc({ match: null }), /MATCH_NOT_AVAILABLE/);
    assert.throws(
      () => callRpc({ match: { matchId: "match-1", authoritative: true, size: 2, label: "" } }),
      /ROOM_FULL/,
    );
  });
});

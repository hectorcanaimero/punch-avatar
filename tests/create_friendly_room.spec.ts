import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

// Integración contra Nakama real (docker compose up -d).
// Requiere que el RPC 'create_friendly_room' esté registrado (T-026).
const BASE_URL = process.env.NAKAMA_HTTP_URL ?? "http://localhost:7350";
const SERVER_KEY = process.env.NAKAMA_SERVER_KEY ?? "defaultkey";

const basicAuth = "Basic " + Buffer.from(`${SERVER_KEY}:`).toString("base64");

interface RpcResult {
  status: number;
  payload?: string;
  message?: string;
}

interface FriendlyRoomResponse {
  code: string;
  matchId: string;
  expiresAt: number;
}

async function authenticateDevice(deviceId: string): Promise<string> {
  const res = await fetch(
    `${BASE_URL}/v2/account/authenticate/device?create=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: basicAuth },
      body: JSON.stringify({ id: deviceId }),
    },
  );
  if (!res.ok) {
    throw new Error(`device auth falló (${res.status}): ${await res.text()}`);
  }
  return ((await res.json()) as { token: string }).token;
}

async function callRpc(
  token: string,
  rpcId: string,
  payload?: string,
): Promise<RpcResult> {
  const res = await fetch(`${BASE_URL}/v2/rpc/${rpcId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload ?? ""),
  });
  const text = await res.text();
  let body: { payload?: string; message?: string } = {};
  try {
    body = JSON.parse(text) as { payload?: string; message?: string };
  } catch {
    body = { message: text };
  }
  return { status: res.status, payload: body.payload, message: body.message };
}

function uniqueDeviceId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("create_friendly_room (integration)", () => {
  let token: string;

  before(async () => {
    // Skip suite si Nakama no está corriendo.
    try {
      const res = await fetch(`${BASE_URL}/healthcheck`);
      if (!res.ok) throw new Error(`health status ${res.status}`);
    } catch (err) {
      throw new Error(
        `Nakama no disponible en ${BASE_URL} (docker compose up -d): ${(err as Error).message}`,
      );
    }
    token = await authenticateDevice(uniqueDeviceId("friendly-host"));
  });

  test("crea sala y devuelve code+matchId+expiresAt", async () => {
    const result = await callRpc(token, "create_friendly_room");
    assert.equal(result.status, 200, `RPC falló: ${result.message}`);
    assert.ok(result.payload, "sin payload");
    const body = JSON.parse(result.payload!) as FriendlyRoomResponse;
    assert.match(body.code, /^[A-HJ-NP-Z2-9]{6}$/, `código inválido: ${body.code}`);
    assert.ok(typeof body.matchId === "string" && body.matchId.length > 0);
    assert.ok(body.expiresAt > Date.now(), "expiresAt debe ser futuro");
    assert.ok(
      body.expiresAt <= Date.now() + 16 * 60 * 1000,
      "expiresAt no debe exceder TTL de 15min",
    );
  });

  test("dos calls consecutivas generan códigos distintos", async () => {
    const a = await callRpc(token, "create_friendly_room");
    const b = await callRpc(token, "create_friendly_room");
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const bodyA = JSON.parse(a.payload!) as FriendlyRoomResponse;
    const bodyB = JSON.parse(b.payload!) as FriendlyRoomResponse;
    assert.notEqual(bodyA.code, bodyB.code, "colisión de códigos");
    assert.notEqual(bodyA.matchId, bodyB.matchId, "colisión de matchId");
  });

  test("rechaza sin autenticación", async () => {
    const res = await fetch(`${BASE_URL}/v2/rpc/create_friendly_room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(""),
    });
    assert.ok(
      res.status === 401 || res.status === 403,
      `esperaba 401/403, obtuve ${res.status}`,
    );
  });
});

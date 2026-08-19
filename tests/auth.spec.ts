import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

// Integración contra Nakama real (docker compose up -d).
// Protocolo HTTP:
//  - auth de dispositivo/custom exige server key vía Basic auth.
//  - POST /v2/rpc/{id} recibe el payload como JSON-string y responde
//    { payload: "<retorno del RPC>" } o { code, message } en error.
const BASE_URL = process.env.NAKAMA_HTTP_URL ?? "http://localhost:7350";
const SERVER_KEY = process.env.NAKAMA_SERVER_KEY ?? "defaultkey";

const basicAuth = "Basic " + Buffer.from(`${SERVER_KEY}:`).toString("base64");

interface RpcResult {
  status: number;
  payload?: string;
  message?: string;
}

interface RegisteredUser {
  username: string;
  userId: string;
  profile: Record<string, unknown>;
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

async function authenticateCustom(customId: string): Promise<string> {
  const res = await fetch(
    `${BASE_URL}/v2/account/authenticate/custom?create=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: basicAuth },
      body: JSON.stringify({ id: customId }),
    },
  );
  if (!res.ok) {
    throw new Error(`custom auth falló (${res.status}): ${await res.text()}`);
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
    // WHY: Nakama deserializa el body como string; el payload viaja JSON-encoded.
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

function uniqueUsername(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `t${ts}${rand}`.slice(0, 20);
}

function parsePayload<T>(result: RpcResult): T {
  assert.equal(
    result.status,
    200,
    `esperaba 200, got ${result.status}: ${result.message}`,
  );
  assert.ok(result.payload, "RPC no devolvió payload");
  return JSON.parse(result.payload as string) as T;
}

describe("RPCs auth/perfil (integración Nakama)", () => {
  let registered: RegisteredUser;

  before(async () => {
    const health = await fetch(`${BASE_URL}/healthcheck`).catch(() => null);
    assert.ok(health, `Nakama no responde en ${BASE_URL} — corré \`docker compose up -d\``);

    registered = {
      username: uniqueUsername(),
      userId: "",
      profile: {},
    };
    const deviceToken = await authenticateDevice(`dev-${registered.username}`);
    const result = await callRpc(
      deviceToken,
      "register_profile",
      JSON.stringify({ username: registered.username }),
    );
    const body = parsePayload<{ userId: string; username: string; profile: Record<string, unknown> }>(
      result,
    );
    registered.userId = body.userId;
    registered.profile = body.profile;
  });

  test("registro exitoso crea perfil con defaults del PRD §5", () => {
    assert.ok(registered.userId, "userId debería ser no vacío");
    assert.equal(registered.profile.displayName, registered.username);
    assert.equal(registered.profile.level, 1);
    assert.equal(registered.profile.xp, 0);
    assert.equal(registered.profile.wins, 0);
    assert.equal(registered.profile.losses, 0);
    assert.equal(registered.profile.kos, 0);
    assert.equal(registered.profile.rankScore, 1000);
    assert.equal(registered.profile.careerProgress, 0);
    assert.deepEqual(registered.profile.unlocks, []);
    assert.equal(registered.profile.avatarUrl, null);
    assert.equal(registered.profile.avatarStyle, null);
  });

  test("username duplicado devuelve USERNAME_TAKEN sin crear cuenta", async () => {
    const token = await authenticateDevice(`dev-dup-${registered.username}`);
    const result = await callRpc(
      token,
      "register_profile",
      JSON.stringify({ username: registered.username }),
    );

    assert.ok(result.status >= 400, `esperaba error, got ${result.status}`);
    assert.match(result.message ?? "", /USERNAME_TAKEN/);
  });

  test("username reservado devuelve USERNAME_INVALID:reserved", async () => {
    const token = await authenticateDevice("dev-reserved-admin");
    const result = await callRpc(
      token,
      "register_profile",
      JSON.stringify({ username: "admin" }),
    );

    assert.ok(result.status >= 400);
    assert.match(result.message ?? "", /USERNAME_INVALID:reserved/);
  });

  test("get_profile devuelve el perfil por userId", async () => {
    const token = await authenticateCustom(registered.username);
    const result = await callRpc(
      token,
      "get_profile",
      JSON.stringify({ userId: registered.userId }),
    );
    const body = parsePayload<{ userId: string; profile: Record<string, unknown> }>(result);

    assert.equal(body.userId, registered.userId);
    assert.equal(body.profile.displayName, registered.username);
  });

  test("get_profile sin userId devuelve el perfil del caller", async () => {
    const token = await authenticateCustom(registered.username);
    const result = await callRpc(token, "get_profile");
    const body = parsePayload<{ userId: string; profile: Record<string, unknown> }>(result);

    assert.equal(body.userId, registered.userId);
    assert.equal(body.profile.displayName, registered.username);
  });

  test("update_display_name actualiza y persiste el displayName", async () => {
    const token = await authenticateCustom(registered.username);
    const newName = "Rocky Balboa";
    const result = await callRpc(
      token,
      "update_display_name",
      JSON.stringify({ displayName: newName }),
    );
    const body = parsePayload<{ userId: string; profile: Record<string, unknown> }>(result);

    assert.equal(body.userId, registered.userId);
    assert.equal(body.profile.displayName, newName);

    const persisted = await callRpc(token, "get_profile");
    const persistedBody = parsePayload<{ profile: Record<string, unknown> }>(persisted);
    assert.equal(persistedBody.profile.displayName, newName);
  });
});

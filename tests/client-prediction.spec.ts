import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  initialPredictionState,
  predictLocalInput,
  reconcileServerMessage,
  tickPrediction,
} from "../client/src/lib/prediction";
import { ClientOpcode, ServerOpcode } from "../src/protocol/opcodes";
import type { PlayerStateView } from "../shared/types";

const playerId = "user-1";

const rivalPlayer: PlayerStateView = {
  userId: "user-2",
  avatarUrl: "",
  health: 100,
  blocking: false,
  blockSide: null,
  charge: 30,
  stance: "idle",
};

const mePlayer = (overrides: Partial<PlayerStateView> = {}): PlayerStateView => ({
  userId: playerId,
  avatarUrl: "",
  health: 100,
  blocking: false,
  blockSide: null,
  charge: 0,
  stance: "idle",
  ...overrides,
});

describe("initialPredictionState", () => {
  test("empieza sin guante activo y sin special pendiente", () => {
    assert.deepEqual(initialPredictionState(), {
      activeGlove: null,
      gloveExpiresAt: 0,
      pendingSpecial: false,
    });
  });
});

describe("predictLocalInput", () => {
  test("PUNCH_LEFT levanta el guante izquierdo por 200ms", () => {
    const next = predictLocalInput(
      initialPredictionState(),
      { opcode: ClientOpcode.PUNCH_LEFT },
      1_000,
    );
    assert.equal(next.activeGlove, "left");
    assert.equal(next.gloveExpiresAt, 1_200);
  });

  test("PUNCH_RIGHT levanta el guante derecho", () => {
    const next = predictLocalInput(
      initialPredictionState(),
      { opcode: ClientOpcode.PUNCH_RIGHT },
      500,
    );
    assert.equal(next.activeGlove, "right");
    assert.equal(next.gloveExpiresAt, 700);
  });

  test("SPECIAL marca pendingSpecial sin tocar guante", () => {
    const next = predictLocalInput(
      initialPredictionState(),
      { opcode: ClientOpcode.SPECIAL },
      0,
    );
    assert.equal(next.pendingSpecial, true);
    assert.equal(next.activeGlove, null);
  });

  test("BLOCK_START/BLOCK_END no modifican estado cosmético", () => {
    const base = initialPredictionState();
    assert.deepEqual(
      predictLocalInput(base, { opcode: ClientOpcode.BLOCK_START, side: "left" }, 0),
      base,
    );
    assert.deepEqual(
      predictLocalInput(base, { opcode: ClientOpcode.BLOCK_END }, 0),
      base,
    );
  });
});

describe("tickPrediction", () => {
  test("expira el guante cuando pasa el tiempo", () => {
    const state = { activeGlove: "left" as const, gloveExpiresAt: 500, pendingSpecial: false };
    const next = tickPrediction(state, 600);
    assert.equal(next.activeGlove, null);
    assert.equal(next.gloveExpiresAt, 0);
  });

  test("mantiene el guante mientras no expiró", () => {
    const state = { activeGlove: "right" as const, gloveExpiresAt: 500, pendingSpecial: false };
    const next = tickPrediction(state, 400);
    assert.equal(next.activeGlove, "right");
  });
});

describe("reconcileServerMessage", () => {
  test("STATE_TICK con carga=0 limpia pendingSpecial", () => {
    const state = { activeGlove: null, gloveExpiresAt: 0, pendingSpecial: true };
    const next = reconcileServerMessage(
      state,
      {
        opcode: ServerOpcode.STATE_TICK,
        tick: 42,
        players: { [playerId]: mePlayer({ charge: 0 }), "user-2": rivalPlayer },
        status: "active",
        winner: null,
      },
      playerId,
    );
    assert.equal(next.pendingSpecial, false);
  });

  test("STATE_TICK con carga>0 preserva pendingSpecial (aún no consumida)", () => {
    const state = { activeGlove: null, gloveExpiresAt: 0, pendingSpecial: true };
    const next = reconcileServerMessage(
      state,
      {
        opcode: ServerOpcode.STATE_TICK,
        tick: 42,
        players: { [playerId]: mePlayer({ charge: 50 }), "user-2": rivalPlayer },
        status: "active",
        winner: null,
      },
      playerId,
    );
    assert.equal(next.pendingSpecial, true);
  });

  test("STRIKE de otro atacante no modifica estado", () => {
    const state = { activeGlove: "left" as const, gloveExpiresAt: 500, pendingSpecial: false };
    const next = reconcileServerMessage(
      state,
      {
        opcode: ServerOpcode.STRIKE,
        side: "left",
        attackerId: "user-2",
        targetId: playerId,
        damage: 8,
        blocked: false,
      },
      playerId,
    );
    assert.deepEqual(next, state);
  });

  test("TELEGRAPH / FEINT / KO no afectan prediction", () => {
    const state = { activeGlove: null, gloveExpiresAt: 0, pendingSpecial: false };
    assert.deepEqual(
      reconcileServerMessage(
        state,
        {
          opcode: ServerOpcode.TELEGRAPH,
          side: "right",
          attackerId: "user-2",
          durationMs: 300,
        },
        playerId,
      ),
      state,
    );
    assert.deepEqual(
      reconcileServerMessage(
        state,
        { opcode: ServerOpcode.FEINT, side: "right", attackerId: "user-2" },
        playerId,
      ),
      state,
    );
    assert.deepEqual(
      reconcileServerMessage(
        state,
        { opcode: ServerOpcode.KO, winnerId: "user-2", loserId: playerId },
        playerId,
      ),
      state,
    );
  });
});

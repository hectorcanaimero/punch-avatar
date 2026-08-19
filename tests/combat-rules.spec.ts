import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { PlayerStateView } from "../shared/types";
import {
  type CombatState,
  resolveBlock,
  resolvePunch,
  resolveSpecial,
} from "../src/matches/combat-rules";

function player(userId: string): PlayerStateView {
  return {
    userId,
    avatarUrl: "",
    health: 100,
    blocking: false,
    blockSide: null,
    charge: 0,
    stance: "idle",
  };
}

function activeState(): CombatState {
  return {
    players: {
      attacker: player("user-a"),
      defender: player("user-b"),
    },
    status: "active",
    winner: null,
  };
}

describe("combat rules", () => {
  test("un golpe conecta, daña y carga a ambos sin mutar el estado original", () => {
    const state = activeState();
    const result = resolvePunch(state, "left", "attacker");

    assert.equal(result.players.defender.health, 92);
    assert.equal(result.players.attacker.charge, 10);
    assert.equal(result.players.defender.charge, 10);
    assert.equal(state.players.defender.health, 100);
  });

  test("el bloqueo solo anula el golpe del lado correcto", () => {
    const state = resolveBlock(activeState(), "left", "defender");

    assert.equal(resolvePunch(state, "left", "attacker"), state);
    assert.equal(resolvePunch(state, "right", "attacker").players.defender.health, 92);
  });

  test("el especial requiere carga, ignora bloqueo y resetea al atacante", () => {
    const state = resolveBlock(activeState(), "left", "defender");
    state.players.attacker.charge = 100;

    const result = resolveSpecial(state, "attacker");

    assert.equal(result.players.defender.health, 70);
    assert.equal(result.players.attacker.charge, 0);
    assert.equal(result.players.defender.charge, 10);
  });

  test("un golpe letal limita HP a cero y termina el combate", () => {
    const state = activeState();
    state.players.defender.health = 4;

    const result = resolvePunch(state, "right", "attacker");

    assert.equal(result.players.defender.health, 0);
    assert.equal(result.status, "ended");
    assert.equal(result.winner, "user-a");
  });
});

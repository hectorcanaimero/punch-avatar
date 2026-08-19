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

  test("un golpe bloqueado del lado correcto no causa daño ni carga", () => {
    const state = resolveBlock(activeState(), "left", "defender");

    assert.equal(resolvePunch(state, "left", "attacker"), state);
    assert.equal(state.players.defender.health, 100);
    assert.equal(state.players.attacker.charge, 0);
    assert.equal(state.players.defender.charge, 0);
  });

  test("un bloqueo del lado incorrecto permite que el golpe conecte", () => {
    const state = resolveBlock(activeState(), "left", "defender");

    const result = resolvePunch(state, "right", "attacker");

    assert.equal(result.players.defender.health, 92);
    assert.equal(result.players.attacker.charge, 10);
    assert.equal(result.players.defender.charge, 10);
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

  test("la carga acumulada nunca supera el máximo", () => {
    const state = activeState();
    state.players.attacker.charge = 95;
    state.players.defender.charge = 95;

    const result = resolvePunch(state, "left", "attacker");

    assert.equal(result.players.attacker.charge, 100);
    assert.equal(result.players.defender.charge, 100);
  });
});

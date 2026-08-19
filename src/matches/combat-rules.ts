import type { MatchStatus, PlayerStateView, Side } from "../../shared/types";
import { COMBAT_BALANCE } from "../config/combat";

export interface CombatState {
  players: Record<string, PlayerStateView>;
  status: MatchStatus;
  winner: string | null;
}

function opponentId(state: CombatState, playerId: string): string | null {
  const ids = Object.keys(state.players);
  if (ids.length !== 2 || !state.players[playerId]) {
    return null;
  }

  return ids[0] === playerId ? ids[1] : ids[0];
}

function addCharge(charge: number): number {
  return Math.min(
    COMBAT_BALANCE.maxCharge,
    charge + COMBAT_BALANCE.chargePerConnectedHit
  );
}

function finishIfKnockedOut(
  state: CombatState,
  attackerId: string,
  defenderId: string
): CombatState {
  const defender = state.players[defenderId];
  if (defender.health > 0) {
    return state;
  }

  return {
    ...state,
    status: "ended",
    winner: state.players[attackerId].userId,
  };
}

export function resolvePunch(
  state: CombatState,
  side: Side,
  attackerId: string
): CombatState {
  const defenderId = opponentId(state, attackerId);
  if (state.status !== "active" || defenderId === null) {
    return state;
  }

  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  if (attacker.blocking || (defender.blocking && defender.blockSide === side)) {
    return state;
  }

  const nextState: CombatState = {
    ...state,
    players: {
      ...state.players,
      [attackerId]: { ...attacker, charge: addCharge(attacker.charge) },
      [defenderId]: {
        ...defender,
        health: Math.max(0, defender.health - COMBAT_BALANCE.punchDamage),
        charge: addCharge(defender.charge),
      },
    },
  };

  return finishIfKnockedOut(nextState, attackerId, defenderId);
}

export function resolveBlock(
  state: CombatState,
  side: Side | null,
  playerId: string
): CombatState {
  const player = state.players[playerId];
  if (state.status !== "active" || !player) {
    return state;
  }

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        blocking: side !== null,
        blockSide: side,
      },
    },
  };
}

export function resolveSpecial(
  state: CombatState,
  attackerId: string
): CombatState {
  const defenderId = opponentId(state, attackerId);
  if (state.status !== "active" || defenderId === null) {
    return state;
  }

  const attacker = state.players[attackerId];
  if (attacker.blocking || attacker.charge < COMBAT_BALANCE.maxCharge) {
    return state;
  }

  const defender = state.players[defenderId];
  const nextState: CombatState = {
    ...state,
    players: {
      ...state.players,
      // The attacker's connected-hit charge is superseded by the required reset.
      [attackerId]: { ...attacker, charge: 0 },
      [defenderId]: {
        ...defender,
        health: Math.max(0, defender.health - COMBAT_BALANCE.specialDamage),
        charge: addCharge(defender.charge),
      },
    },
  };

  return finishIfKnockedOut(nextState, attackerId, defenderId);
}

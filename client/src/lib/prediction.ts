import { ClientOpcode, ServerOpcode } from "../../../src/protocol/opcodes";
import type {
  ClientMessage,
  ServerMessage,
  Side,
} from "../../../shared/types";

// WHY: prediction cosmética únicamente. Movemos el guante local al instante
// para que el input se sienta sin lag; nunca predecimos daño/carga/HP porque
// esos son autoritativos del servidor y una corrección visible sería peor
// que esperar el tick.
const GLOVE_VISIBLE_MS = 200;

export interface PredictionState {
  activeGlove: Side | null;
  gloveExpiresAt: number;
  pendingSpecial: boolean;
}

export function initialPredictionState(): PredictionState {
  return { activeGlove: null, gloveExpiresAt: 0, pendingSpecial: false };
}

export function predictLocalInput(
  state: PredictionState,
  msg: ClientMessage,
  now: number,
): PredictionState {
  switch (msg.opcode) {
    case ClientOpcode.PUNCH_LEFT:
      return { ...state, activeGlove: "left", gloveExpiresAt: now + GLOVE_VISIBLE_MS };
    case ClientOpcode.PUNCH_RIGHT:
      return { ...state, activeGlove: "right", gloveExpiresAt: now + GLOVE_VISIBLE_MS };
    case ClientOpcode.SPECIAL:
      return { ...state, pendingSpecial: true };
    case ClientOpcode.BLOCK_START:
    case ClientOpcode.BLOCK_END:
      return state;
  }
}

export function reconcileServerMessage(
  state: PredictionState,
  msg: ServerMessage,
  playerId: string,
): PredictionState {
  switch (msg.opcode) {
    // WHY: cuando el servidor confirma que MI golpe pegó, mantenemos el
    // guante visible un tick más para que la animación coincida con el
    // impacto en el rival. Si el atacante no soy yo, no tocamos prediction.
    case ServerOpcode.STRIKE:
      if (msg.attackerId !== playerId) return state;
      return state;

    // WHY: el servidor consumió la carga del special. Limpiamos el pending.
    case ServerOpcode.STATE_TICK: {
      const me = msg.players[playerId];
      if (state.pendingSpecial && me && me.charge === 0) {
        return { ...state, pendingSpecial: false };
      }
      return state;
    }

    // FEINT, TELEGRAPH, KO: no afectan la predicción cosmética.
    case ServerOpcode.TELEGRAPH:
    case ServerOpcode.FEINT:
    case ServerOpcode.KO:
      return state;
  }
}

export function tickPrediction(state: PredictionState, now: number): PredictionState {
  if (state.activeGlove && now >= state.gloveExpiresAt) {
    return { ...state, activeGlove: null, gloveExpiresAt: 0 };
  }
  return state;
}

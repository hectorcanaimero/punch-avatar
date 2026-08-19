import type { ClientOpcode, ServerOpcode } from "../src/protocol/opcodes";

export type Side = "left" | "right";

export type MatchStatus = "waiting" | "countdown" | "active" | "ko" | "ended";

export type Stance = "idle" | "vulnerable";

// ---------- Client -> Server messages ----------

export interface PunchLeftMessage {
  opcode: ClientOpcode.PUNCH_LEFT;
}

export interface PunchRightMessage {
  opcode: ClientOpcode.PUNCH_RIGHT;
}

export interface BlockStartMessage {
  opcode: ClientOpcode.BLOCK_START;
  side: Side;
}

export interface BlockEndMessage {
  opcode: ClientOpcode.BLOCK_END;
}

export interface SpecialMessage {
  opcode: ClientOpcode.SPECIAL;
}

export type ClientMessage =
  | PunchLeftMessage
  | PunchRightMessage
  | BlockStartMessage
  | BlockEndMessage
  | SpecialMessage;

// ---------- Server -> Client messages ----------

export interface TelegraphMessage {
  opcode: ServerOpcode.TELEGRAPH;
  side: Side;
  attackerId: string;
  durationMs: number;
}

export interface StrikeMessage {
  opcode: ServerOpcode.STRIKE;
  side: Side;
  attackerId: string;
  targetId: string;
  damage: number;
  blocked: boolean;
}

export interface KoMessage {
  opcode: ServerOpcode.KO;
  winnerId: string;
  loserId: string;
}

export interface FeintMessage {
  opcode: ServerOpcode.FEINT;
  side: Side;
  attackerId: string;
}

export interface StateTickMessage {
  opcode: ServerOpcode.STATE_TICK;
  tick: number;
  players: Record<string, PlayerStateView>;
  status: MatchStatus;
  winner: string | null;
}

export type ServerMessage =
  | TelegraphMessage
  | StrikeMessage
  | KoMessage
  | FeintMessage
  | StateTickMessage;

// ---------- Shared state views ----------

export interface PlayerStateView {
  userId: string;
  avatarUrl: string;
  health: number;
  blocking: boolean;
  blockSide: Side | null;
  charge: number;
  stance: Stance;
}

export interface MatchStateView {
  players: Record<string, PlayerStateView>;
  status: MatchStatus;
  winner: string | null;
  tick: number;
}

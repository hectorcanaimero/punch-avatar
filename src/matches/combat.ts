import { ClientOpcode, ServerOpcode } from "../protocol/opcodes";
import {
  resolveBlock,
  resolvePunch,
  resolveSpecial,
  type CombatState as RuleState,
} from "./combat-rules";
import type { MatchStatus, PlayerStateView, Side, Stance } from "../../shared/types";

const MAX_PLAYERS = 2;
const TICK_RATE = 10;
const COUNTDOWN_TICKS = 30; // 3s @ 10Hz — waiting → countdown → active
const COMIC_MISS_PROB = 0.05;
const VULNERABLE_TICKS = 5; // 500ms de stance vulnerable tras miss cómico

export type CombatMode = "friendly" | "ranked" | "career";

export interface CombatPlayerState {
  userId: string;
  sessionId: string;
  avatarUrl: string;
  displayName: string;
  health: number;
  blocking: boolean;
  blockSide: Side | null;
  charge: number;
  stance: Stance;
  vulnerableUntilTick: number | null;
}

export interface CombatState {
  mode: CombatMode;
  code: string | null;
  players: { [sessionId: string]: CombatPlayerState };
  status: MatchStatus;
  winner: string | null;
  tick: number;
  countdownEndTick: number | null;
  createdAtMs: number;
}

interface MatchInitParams {
  mode?: string;
  code?: string;
}

function normalizeMode(raw: string | undefined): CombatMode {
  return raw === "ranked" || raw === "career" ? raw : "friendly";
}

function buildLabel(state: CombatState): string {
  // WHY: label es lo único indexable server-side para lookups (join by code, browser).
  return JSON.stringify({
    mode: state.mode,
    code: state.code,
    players: Object.keys(state.players).length,
    status: state.status,
  });
}

function readProfileForPresence(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  userId: string
): { avatarUrl: string; displayName: string } {
  try {
    const objs = nk.storageRead([
      { collection: "profiles", key: "profile", userId },
    ]);
    if (objs.length === 0) return { avatarUrl: "", displayName: "" };
    const v = objs[0].value as { avatarUrl?: string; displayName?: string };
    return {
      avatarUrl: typeof v.avatarUrl === "string" ? v.avatarUrl : "",
      displayName: typeof v.displayName === "string" ? v.displayName : "",
    };
  } catch (err) {
    // WHY: Nakama lanza si no encuentra la key; degradamos a defaults para no romper join.
    logger.warn(
      `combat: readProfile failed for ${userId}: ${(err as Error).message}`
    );
    return { avatarUrl: "", displayName: "" };
  }
}

const matchInit: nkruntime.MatchInitFunction<CombatState> = (
  _ctx,
  _logger,
  _nk,
  params
) => {
  const p = (params ?? {}) as MatchInitParams;
  const state: CombatState = {
    mode: normalizeMode(p.mode),
    code: typeof p.code === "string" && p.code.length > 0 ? p.code : null,
    players: {},
    status: "waiting",
    winner: null,
    tick: 0,
    countdownEndTick: null,
    createdAtMs: Date.now(),
  };
  return {
    state,
    tickRate: TICK_RATE,
    label: buildLabel(state),
  };
};

const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<CombatState> = (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  presence,
  _metadata
) => {
  if (state.status !== "waiting") {
    return { state, accept: false, rejectMessage: "match_already_started" };
  }
  if (Object.keys(state.players).length >= MAX_PLAYERS) {
    return { state, accept: false, rejectMessage: "match_full" };
  }
  const alreadyIn = Object.keys(state.players).some(
    (sid) => state.players[sid].userId === presence.userId
  );
  if (alreadyIn) {
    return { state, accept: false, rejectMessage: "already_joined" };
  }
  return { state, accept: true };
};

const matchJoin: nkruntime.MatchJoinFunction<CombatState> = (
  _ctx,
  logger,
  nk,
  dispatcher,
  _tick,
  state,
  presences
) => {
  for (const pres of presences) {
    if (state.players[pres.sessionId]) continue;
    const profile = readProfileForPresence(nk, logger, pres.userId);
    state.players[pres.sessionId] = {
      userId: pres.userId,
      sessionId: pres.sessionId,
      avatarUrl: profile.avatarUrl,
      displayName: profile.displayName,
      health: 100,
      blocking: false,
      blockSide: null,
      charge: 0,
      stance: "idle",
      vulnerableUntilTick: null,
    };
  }
  dispatcher.matchLabelUpdate(buildLabel(state));
  return { state };
};

const matchLeave: nkruntime.MatchLeaveFunction<CombatState> = (
  _ctx,
  logger,
  _nk,
  dispatcher,
  _tick,
  state,
  presences
) => {
  const leftSessionIds = new Set(presences.map((p) => p.sessionId));

  // WHY: abandono mid-combate cuenta como derrota (PRD §6). En waiting solo removemos.
  if (state.status === "countdown" || state.status === "active") {
    const remaining = Object.values(state.players).filter(
      (p) => !leftSessionIds.has(p.sessionId)
    );
    const leaver = Object.values(state.players).find((p) =>
      leftSessionIds.has(p.sessionId)
    );

    if (remaining.length === 1 && leaver) {
      state.status = "ended";
      state.winner = remaining[0].userId;
      dispatcher.broadcastMessage(
        ServerOpcode.KO,
        JSON.stringify({
          opcode: ServerOpcode.KO,
          winnerId: remaining[0].userId,
          loserId: leaver.userId,
          reason: "abandon",
        })
      );
      logger.info(
        `combat: abandon by ${leaver.userId} → winner ${remaining[0].userId}`
      );
    } else if (remaining.length === 0) {
      state.status = "ended";
      state.winner = null;
      logger.info("combat: both players left, no winner");
    }
  }

  for (const p of presences) delete state.players[p.sessionId];
  dispatcher.matchLabelUpdate(buildLabel(state));
  return { state };
};

function toRuleState(state: CombatState): RuleState {
  const players: Record<string, PlayerStateView> = {};
  for (const sid of Object.keys(state.players)) {
    const p = state.players[sid];
    players[sid] = {
      userId: p.userId,
      avatarUrl: p.avatarUrl,
      health: p.health,
      blocking: p.blocking,
      blockSide: p.blockSide,
      charge: p.charge,
      stance: p.stance,
    };
  }
  return { players, status: state.status, winner: state.winner };
}

function applyRuleState(state: CombatState, ruled: RuleState): void {
  for (const sid of Object.keys(ruled.players)) {
    const src = ruled.players[sid];
    const dst = state.players[sid];
    if (!dst) continue;
    dst.health = src.health;
    dst.blocking = src.blocking;
    dst.blockSide = src.blockSide;
    dst.charge = src.charge;
    dst.stance = src.stance;
  }
  state.status = ruled.status;
  state.winner = ruled.winner;
}

function opponentSessionId(
  state: CombatState,
  sessionId: string
): string | null {
  const ids = Object.keys(state.players);
  if (ids.length !== 2 || !state.players[sessionId]) return null;
  return ids[0] === sessionId ? ids[1] : ids[0];
}

function playerViewsForBroadcast(
  state: CombatState
): Record<string, PlayerStateView> {
  const out: Record<string, PlayerStateView> = {};
  for (const sid of Object.keys(state.players)) {
    const p = state.players[sid];
    out[sid] = {
      userId: p.userId,
      avatarUrl: p.avatarUrl,
      health: p.health,
      blocking: p.blocking,
      blockSide: p.blockSide,
      charge: p.charge,
      stance: p.stance,
    };
  }
  return out;
}

function binaryToString(buf: ArrayBuffer): string {
  // WHY: Goja no incluye TextDecoder; usamos String.fromCharCode sobre Uint8Array
  // (suficiente para JSON ASCII de nuestros opcodes).
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function parseBlockPayload(data: ArrayBuffer): Side | null {
  if (data.byteLength === 0) return null;
  try {
    const parsed = JSON.parse(binaryToString(data)) as { side?: unknown };
    return parsed.side === "left" || parsed.side === "right"
      ? parsed.side
      : null;
  } catch {
    return null;
  }
}

const matchLoop: nkruntime.MatchLoopFunction<CombatState> = (
  _ctx,
  logger,
  _nk,
  dispatcher,
  tick,
  state,
  messages
) => {
  state.tick = tick;

  // 1. Vulnerable stance revert (self-heal after comic miss).
  for (const sid of Object.keys(state.players)) {
    const p = state.players[sid];
    if (
      p.stance === "vulnerable" &&
      p.vulnerableUntilTick !== null &&
      tick >= p.vulnerableUntilTick
    ) {
      p.stance = "idle";
      p.vulnerableUntilTick = null;
    }
  }

  // 2. Auto-transitions: waiting → countdown → active.
  if (
    state.status === "waiting" &&
    Object.keys(state.players).length === MAX_PLAYERS
  ) {
    state.status = "countdown";
    state.countdownEndTick = tick + COUNTDOWN_TICKS;
    logger.info(`combat: countdown started at tick ${tick}`);
  }
  if (
    state.status === "countdown" &&
    state.countdownEndTick !== null &&
    tick >= state.countdownEndTick
  ) {
    state.status = "active";
    state.countdownEndTick = null;
    logger.info(`combat: active at tick ${tick}`);
  }

  // 3. Process messages only in active. Ignore during countdown/waiting/ended.
  if (state.status === "active") {
    for (const msg of messages) {
      const senderSid = msg.sender.sessionId;
      if (!state.players[senderSid]) continue;

      switch (msg.opCode) {
        case ClientOpcode.PUNCH_LEFT:
        case ClientOpcode.PUNCH_RIGHT: {
          const side: Side =
            msg.opCode === ClientOpcode.PUNCH_LEFT ? "left" : "right";
          const targetSid = opponentSessionId(state, senderSid);
          if (!targetSid) break;

          // WHY: 5% comic miss = self-stagger; consume el intento sin daño y
          // marca al atacante vulnerable por 500ms (T-054 lo animará).
          if (Math.random() < COMIC_MISS_PROB) {
            const attacker = state.players[senderSid];
            attacker.stance = "vulnerable";
            attacker.vulnerableUntilTick = tick + VULNERABLE_TICKS;
            break;
          }

          const defenderBefore = state.players[targetSid].health;
          const ruled = resolvePunch(toRuleState(state), side, senderSid);
          applyRuleState(state, ruled);
          const defenderAfter = state.players[targetSid].health;
          const damage = defenderBefore - defenderAfter;

          dispatcher.broadcastMessage(
            ServerOpcode.STRIKE,
            JSON.stringify({
              opcode: ServerOpcode.STRIKE,
              side,
              attackerId: state.players[senderSid].userId,
              targetId: state.players[targetSid].userId,
              damage,
              blocked: damage === 0,
            })
          );
          break;
        }
        case ClientOpcode.BLOCK_START: {
          const side = parseBlockPayload(msg.data);
          if (!side) break;
          applyRuleState(state, resolveBlock(toRuleState(state), side, senderSid));
          break;
        }
        case ClientOpcode.BLOCK_END: {
          applyRuleState(state, resolveBlock(toRuleState(state), null, senderSid));
          break;
        }
        case ClientOpcode.SPECIAL: {
          const targetSid = opponentSessionId(state, senderSid);
          if (!targetSid) break;
          const chargeBefore = state.players[senderSid].charge;
          const defenderBefore = state.players[targetSid].health;
          const ruled = resolveSpecial(toRuleState(state), senderSid);
          applyRuleState(state, ruled);
          const chargeAfter = state.players[senderSid].charge;
          if (chargeAfter >= chargeBefore) break; // no consumed → charge insuficiente
          const damage = defenderBefore - state.players[targetSid].health;
          dispatcher.broadcastMessage(
            ServerOpcode.STRIKE,
            JSON.stringify({
              opcode: ServerOpcode.STRIKE,
              side: "left",
              attackerId: state.players[senderSid].userId,
              targetId: state.players[targetSid].userId,
              damage,
              blocked: false,
              special: true,
            })
          );
          break;
        }
        default:
          break;
      }

      if ((state.status as MatchStatus) === "ended") break; // KO detectado por las reglas
    }
  }

  // 4. KO broadcast (una sola vez cuando transiciona a ended por reglas).
  if ((state.status as MatchStatus) === "ended" && state.winner !== null) {
    const winnerId = state.winner;
    const loser = Object.values(state.players).find(
      (p) => p.userId !== winnerId
    );
    dispatcher.broadcastMessage(
      ServerOpcode.KO,
      JSON.stringify({
        opcode: ServerOpcode.KO,
        winnerId,
        loserId: loser?.userId ?? "",
        reason: "knockout",
      })
    );
    // WHY: transición a estado sentinel para no re-broadcastear KO cada tick.
    state.status = "ko";
    dispatcher.matchLabelUpdate(buildLabel(state));
  }

  // 5. STATE_TICK broadcast — full state cada tick (MVP; T-057 puede optimizar deltas).
  dispatcher.broadcastMessage(
    ServerOpcode.STATE_TICK,
    JSON.stringify({
      opcode: ServerOpcode.STATE_TICK,
      tick: state.tick,
      players: playerViewsForBroadcast(state),
      status: state.status,
      winner: state.winner,
    })
  );

  return { state };
};

const matchTerminate: nkruntime.MatchTerminateFunction<CombatState> = (
  _ctx,
  logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  graceSeconds
) => {
  // WHY: los hooks postmatch (T-035 career, T-040 xp, T-041 achievements, T-042
  // leaderboard, T-049 elo) leen state.winner + state.status desde acá. No los
  // invocamos directo — cada uno se registra en su propia task.
  logger.info(
    `combat: terminate mode=${state.mode} status=${state.status} winner=${state.winner ?? "none"} grace=${graceSeconds}s players=${Object.keys(state.players).length}`
  );
  return { state };
};

interface SignalRequest {
  cmd?: string;
}
interface SignalResponse {
  ok: boolean;
  status?: MatchStatus;
  winner?: string | null;
  players?: number;
  mode?: CombatMode;
  message?: string;
}

const matchSignal: nkruntime.MatchSignalFunction<CombatState> = (
  _ctx,
  logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  data
) => {
  let cmd = "status";
  if (data && data.length > 0) {
    try {
      const parsed = JSON.parse(data) as SignalRequest;
      if (typeof parsed.cmd === "string") cmd = parsed.cmd;
    } catch {
      const resp: SignalResponse = { ok: false, message: "invalid_json" };
      return { state, data: JSON.stringify(resp) };
    }
  }

  switch (cmd) {
    case "status": {
      const resp: SignalResponse = {
        ok: true,
        status: state.status,
        winner: state.winner,
        players: Object.keys(state.players).length,
        mode: state.mode,
      };
      return { state, data: JSON.stringify(resp) };
    }
    case "terminate": {
      state.status = "ended";
      logger.info("combat: admin signal → terminate");
      const resp: SignalResponse = { ok: true, status: state.status };
      return { state, data: JSON.stringify(resp) };
    }
    default: {
      const resp: SignalResponse = { ok: false, message: "unknown_cmd" };
      return { state, data: JSON.stringify(resp) };
    }
  }
};

export const combatMatchHandler: nkruntime.MatchHandler<CombatState> = {
  matchInit,
  matchJoinAttempt,
  matchJoin,
  matchLeave,
  matchLoop,
  matchTerminate,
  matchSignal,
};

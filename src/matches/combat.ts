import { ServerOpcode } from "../protocol/opcodes";
import type { MatchStatus, Side, Stance } from "../../shared/types";

const MAX_PLAYERS = 2;
const TICK_RATE = 10;

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
}

export interface CombatState {
  mode: CombatMode;
  code: string | null;
  players: { [sessionId: string]: CombatPlayerState };
  status: MatchStatus;
  winner: string | null;
  tick: number;
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

const matchLoop: nkruntime.MatchLoopFunction<CombatState> = (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  _messages
) => ({ state });

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

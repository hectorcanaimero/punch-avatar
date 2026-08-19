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
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  _presences
) => ({ state });

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
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  _graceSeconds
) => ({ state });

const matchSignal: nkruntime.MatchSignalFunction<CombatState> = (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  _data
) => ({ state });

export const combatMatchHandler: nkruntime.MatchHandler<CombatState> = {
  matchInit,
  matchJoinAttempt,
  matchJoin,
  matchLeave,
  matchLoop,
  matchTerminate,
  matchSignal,
};

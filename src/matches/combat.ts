interface CombatState {}

const matchInit: nkruntime.MatchInitFunction<CombatState> = (
  _ctx,
  _logger,
  _nk,
  _params
) => ({ state: {}, tickRate: 10, label: "" });

const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<CombatState> = (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  _presence,
  _metadata
) => ({ state, accept: true });

const matchJoin: nkruntime.MatchJoinFunction<CombatState> = (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  _presences
) => ({ state });

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

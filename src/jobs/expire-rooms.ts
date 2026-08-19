// Cleanup job: barre la colección `rooms` y borra las salas con TTL vencido.
// Nakama no tiene cron nativo en el runtime, así que usamos el patrón "worker
// match": un match autoritativo sin jugadores cuyo matchLoop hace el barrido
// cada SWEEP_INTERVAL_MS.

// WHY: deben coincidir con los valores de src/rpcs/create_friendly_room.ts (T-026).
// Se duplican acá para no acoplar el job a un archivo que aún no está committeado.
const ROOMS_COLLECTION = "rooms";
// WHY: null-UUID como sentinel — "system" era rechazado por Nakama runtime.
const ROOMS_SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const LIST_PAGE_SIZE = 100;

export interface ExpireRoomsState {
  lastSweepAt: number;
}

// WHY: `value` llega como `{[key: string]: any}` desde storage; validamos el
// tipo de expiresAt en vez de asumirlo para tolerar records corruptos/viejos.
export interface StorageObjectLike {
  key: string;
  value?: { expiresAt?: unknown };
}

export function collectExpiredRoomKeys(
  objects: readonly StorageObjectLike[],
  now: number
): string[] {
  const expired: string[] = [];
  for (const obj of objects) {
    const expiresAt = obj.value?.expiresAt;
    if (typeof expiresAt === "number" && expiresAt <= now) {
      expired.push(obj.key);
    }
  }
  return expired;
}

export function shouldSweep(
  lastSweepAt: number,
  now: number,
  intervalMs: number = SWEEP_INTERVAL_MS
): boolean {
  return now - lastSweepAt >= intervalMs;
}

function sweepExpiredRooms(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  now: number
): number {
  let deleted = 0;
  let cursor: string | undefined;

  do {
    let list: nkruntime.StorageObjectList;
    try {
      list = nk.storageList(
        ROOMS_SYSTEM_USER_ID,
        ROOMS_COLLECTION,
        LIST_PAGE_SIZE,
        cursor
      );
    } catch (err) {
      // WHY: storageList lanza en ciertos casos de lookup; no queremos que un
      // error de storage tumbe el loop del worker.
      logger.warn(
        `expire_rooms: storageList falló: ${(err as Error).message}`
      );
      return deleted;
    }

    const objects = list.objects ?? [];
    const expiredKeys = collectExpiredRoomKeys(objects, now);
    if (expiredKeys.length > 0) {
      try {
        nk.storageDelete(
          expiredKeys.map((key) => ({
            collection: ROOMS_COLLECTION,
            key,
            userId: ROOMS_SYSTEM_USER_ID,
          }))
        );
        deleted += expiredKeys.length;
      } catch (err) {
        logger.warn(
          `expire_rooms: storageDelete falló: ${(err as Error).message}`
        );
      }
    }

    cursor = list.cursor;
  } while (cursor);

  return deleted;
}

const matchInit: nkruntime.MatchInitFunction<ExpireRoomsState> = (
  _ctx,
  _logger,
  _nk,
  _params
) => {
  // WHY: el primer barrido ocurre a los 5 min de arrancado el job (no inmediato),
  // para no competir con el boot de Nakama.
  return {
    state: { lastSweepAt: Date.now() },
    tickRate: 1, // 1 tick/seg: barato, solo compara timestamps.
    label: "expire-rooms",
  };
};

const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<ExpireRoomsState> = (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  _presence,
  _metadata
) => ({ state, accept: false, rejectMessage: "system_match" });

const matchJoin: nkruntime.MatchJoinFunction<ExpireRoomsState> = (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  _presences
) => ({ state });

const matchLeave: nkruntime.MatchLeaveFunction<ExpireRoomsState> = (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  _presences
) => ({ state });

const matchLoop: nkruntime.MatchLoopFunction<ExpireRoomsState> = (
  _ctx,
  logger,
  nk,
  _dispatcher,
  _tick,
  state,
  _messages
) => {
  const now = Date.now();
  if (shouldSweep(state.lastSweepAt, now)) {
    const deleted = sweepExpiredRooms(nk, logger, now);
    if (deleted > 0) {
      logger.info(`expire_rooms: ${deleted} sala(s) expirada(s) eliminadas`);
    }
    return { state: { lastSweepAt: now } };
  }
  return { state };
};

const matchTerminate: nkruntime.MatchTerminateFunction<ExpireRoomsState> = (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  _graceSeconds
) => ({ state });

const matchSignal: nkruntime.MatchSignalFunction<ExpireRoomsState> = (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  _data
) => ({ state });

export const expireRoomsMatchHandler: nkruntime.MatchHandler<ExpireRoomsState> = {
  matchInit,
  matchJoinAttempt,
  matchJoin,
  matchLeave,
  matchLoop,
  matchTerminate,
  matchSignal,
};

export function startExpireRoomsJob(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger
): void {
  nk.matchCreate("expire_rooms", {});
  logger.info("expire_rooms: job programado (sweep cada 5min)");
}

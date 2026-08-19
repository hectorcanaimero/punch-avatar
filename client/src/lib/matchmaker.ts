export const RANK_WINDOWS = [150, 250, 400] as const;
export const WIDEN_DELAYS_MS = [10_000, 20_000] as const;

export interface MatchmakerSocket {
  addMatchmaker(
    query: string,
    minCount: number,
    maxCount: number,
    stringProperties?: Record<string, string>,
    numericProperties?: Record<string, number>,
  ): Promise<{ ticket: string }>;
  removeMatchmaker(ticket: string): Promise<void>;
}

export interface RankedSearchOptions {
  onRangeChanged?: (range: number) => void;
  onError?: (error: Error) => void;
}

export interface RankedSearch {
  cancel(): Promise<void>;
  currentRange(): number;
}

export function buildRankQuery(rankScore: number, range: number): string {
  if (!Number.isFinite(rankScore) || rankScore < 0) {
    throw new Error("RANK_SCORE_INVALID");
  }
  if (!Number.isFinite(range) || range <= 0) {
    throw new Error("RANK_RANGE_INVALID");
  }

  const lower = Math.max(0, rankScore - range);
  const upper = rankScore + range;
  return `+properties.rankScore:>=${lower} +properties.rankScore:<=${upper}`;
}

export async function startRankedSearch(
  socket: MatchmakerSocket,
  rankScore: number,
  options: RankedSearchOptions = {},
): Promise<RankedSearch> {
  let stopped = false;
  let rangeIndex = 0;
  let ticket: string | null = (
    await addTicket(socket, rankScore, RANK_WINDOWS[rangeIndex])
  ).ticket;
  let pendingWiden: Promise<void> = Promise.resolve();
  const timers: ReturnType<typeof setTimeout>[] = [];
  options.onRangeChanged?.(RANK_WINDOWS[rangeIndex]);

  const widen = async (nextIndex: number): Promise<void> => {
    if (stopped || nextIndex <= rangeIndex) return;

    const previousTicket = ticket;
    if (previousTicket === null) return;
    await socket.removeMatchmaker(previousTicket);
    ticket = null;
    if (stopped) return;

    ticket = (await addTicket(socket, rankScore, RANK_WINDOWS[nextIndex])).ticket;
    rangeIndex = nextIndex;
    options.onRangeChanged?.(RANK_WINDOWS[rangeIndex]);
  };

  WIDEN_DELAYS_MS.forEach((delay, index) => {
    timers.push(
      setTimeout(() => {
        // WHY: serializar evita que timers lentos intenten remover el mismo ticket.
        pendingWiden = pendingWiden.then(() => widen(index + 1));
        void pendingWiden.catch((error: unknown) => {
          options.onError?.(toError(error));
        });
      }, delay),
    );
  });

  return {
    currentRange: () => RANK_WINDOWS[rangeIndex],
    cancel: async () => {
      if (stopped) return;
      stopped = true;
      timers.forEach(clearTimeout);
      await pendingWiden.catch(() => undefined);
      if (ticket !== null) {
        await socket.removeMatchmaker(ticket);
        ticket = null;
      }
    },
  };
}

function addTicket(
  socket: MatchmakerSocket,
  rankScore: number,
  range: number,
): Promise<{ ticket: string }> {
  return socket.addMatchmaker(
    buildRankQuery(rankScore, range),
    2,
    2,
    { mode: "ranked" },
    { rankScore },
  );
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

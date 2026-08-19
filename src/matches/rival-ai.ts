import { ServerOpcode } from "../protocol/opcodes";
import type {
  FeintMessage,
  ServerMessage,
  Side,
  TelegraphMessage,
} from "../../shared/types";
import type { Rival } from "../data/rivals";
import { COMBAT_BALANCE } from "../config/combat";

export type RivalAiStateName = "idle" | "telegraph" | "strike" | "recover";

export type RivalAttackType = "punch" | "feint" | "special" | "combo";

export interface RivalActionPlan {
  type: RivalAttackType;
  side: Side;
  damage: number;
  telegraphMs: number;
  isSpecial: boolean;
  isFeint: boolean;
  comboStep?: number;
  totalComboSteps?: number;
}

export interface RivalAiState {
  state: RivalAiStateName;
  ticksInCurrentState: number;
  stateDurationTicks: number;
  currentPlan: RivalActionPlan | null;
  comboQueue: RivalActionPlan[];
  lastAttackType: RivalAttackType | null;
}

export interface RivalAiConfig {
  attackerId?: string;
  targetId?: string;
  minIdleTicks?: number;
  maxIdleTicks?: number;
  recoverTicks?: number;
  specialTelegraphMs?: number;
  specialProbability?: number;
  specialDamage?: number;
}

export type RivalAiEvent =
  | {
      type: "telegraph";
      side: Side;
      durationMs: number;
      isSpecial: boolean;
    }
  | {
      type: "strike";
      side: Side;
      damage: number;
      isSpecial: boolean;
    }
  | {
      type: "feint";
      side: Side;
    };

export interface RivalStrikeOutput {
  side: Side;
  damage: number;
  isSpecial: boolean;
  attackerId: string;
  targetId: string;
}

export interface RivalAiTickResult {
  nextState: RivalAiState;
  events: RivalAiEvent[];
  strike?: RivalStrikeOutput;
  serverMessages: ServerMessage[];
}

export const DEFAULT_AI_CONFIG: Required<RivalAiConfig> = {
  attackerId: "rival",
  targetId: "player",
  minIdleTicks: 5, // 500ms @ 10Hz
  maxIdleTicks: 12, // 1200ms @ 10Hz
  recoverTicks: 5, // 500ms @ 10Hz
  specialTelegraphMs: 1000, // 1s visible wind-up for special
  specialProbability: 0.15,
  specialDamage: COMBAT_BALANCE.specialDamage,
};

function msToTicks(ms: number): number {
  return Math.max(1, Math.round(ms / 100));
}

function randomSide(randomFn: () => number): Side {
  return randomFn() < 0.5 ? "left" : "right";
}

function oppositeSide(side: Side): Side {
  return side === "left" ? "right" : "left";
}

function randomIdleDurationTicks(
  min: number,
  max: number,
  randomFn: () => number
): number {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const delta = high - low;
  return low + Math.floor(randomFn() * (delta + 1));
}

/**
 * Creates initial state in idle.
 */
export function createInitialRivalAiState(
  initialIdleTicks = 8
): RivalAiState {
  return {
    state: "idle",
    ticksInCurrentState: 0,
    stateDurationTicks: Math.max(1, initialIdleTicks),
    currentPlan: null,
    comboQueue: [],
    lastAttackType: null,
  };
}

/**
 * Probabilistically selects the next attack type according to the rival's configuration.
 */
export function selectRivalAction(
  rival: Rival,
  randomFn: () => number = Math.random,
  specialProbability = DEFAULT_AI_CONFIG.specialProbability
): RivalAttackType {
  // 1. Check special attack if rival is high tier (rival 6+).
  if (rival.usesSpecial && randomFn() < specialProbability) {
    return "special";
  }

  // 2. Roll for feint or combo against calibrated probabilities.
  const roll = randomFn();
  if (roll < rival.feintProbability) {
    return "feint";
  }
  if (roll < rival.feintProbability + rival.comboProbability) {
    return "combo";
  }

  // 3. Fallback to standard punch.
  return "punch";
}

/**
 * Generates an action plan (and queued hits if combo) for the chosen attack type.
 */
export function planRivalAttack(
  actionType: RivalAttackType,
  rival: Rival,
  randomFn: () => number = Math.random,
  options?: {
    specialTelegraphMs?: number;
    specialDamage?: number;
  }
): { initialPlan: RivalActionPlan; comboQueue: RivalActionPlan[] } {
  const side = randomSide(randomFn);
  const specialTelegraphMs =
    options?.specialTelegraphMs ?? DEFAULT_AI_CONFIG.specialTelegraphMs;
  const specialDamage =
    options?.specialDamage ?? DEFAULT_AI_CONFIG.specialDamage;

  switch (actionType) {
    case "special": {
      const plan: RivalActionPlan = {
        type: "special",
        side,
        damage: specialDamage,
        telegraphMs: specialTelegraphMs,
        isSpecial: true,
        isFeint: false,
      };
      return { initialPlan: plan, comboQueue: [] };
    }
    case "feint": {
      const plan: RivalActionPlan = {
        type: "feint",
        side,
        damage: 0,
        telegraphMs: rival.telegraphMs,
        isSpecial: false,
        isFeint: true,
      };
      return { initialPlan: plan, comboQueue: [] };
    }
    case "combo": {
      const secondSide = oppositeSide(side);
      // Second hit has a slightly faster telegraph for fluid 1-2 punch feeling.
      const secondTelegraphMs = Math.max(200, Math.round(rival.telegraphMs * 0.75));

      const firstHit: RivalActionPlan = {
        type: "combo",
        side,
        damage: rival.damage,
        telegraphMs: rival.telegraphMs,
        isSpecial: false,
        isFeint: false,
        comboStep: 1,
        totalComboSteps: 2,
      };
      const secondHit: RivalActionPlan = {
        type: "combo",
        side: secondSide,
        damage: rival.damage,
        telegraphMs: secondTelegraphMs,
        isSpecial: false,
        isFeint: false,
        comboStep: 2,
        totalComboSteps: 2,
      };
      return { initialPlan: firstHit, comboQueue: [secondHit] };
    }
    case "punch":
    default: {
      const plan: RivalActionPlan = {
        type: "punch",
        side,
        damage: rival.damage,
        telegraphMs: rival.telegraphMs,
        isSpecial: false,
        isFeint: false,
      };
      return { initialPlan: plan, comboQueue: [] };
    }
  }
}

/**
 * Pure state machine step for one 10Hz tick.
 */
export function tickRivalAi(
  state: RivalAiState,
  rival: Rival,
  userConfig?: Partial<RivalAiConfig>,
  randomFn: () => number = Math.random
): RivalAiTickResult {
  const config: Required<RivalAiConfig> = {
    ...DEFAULT_AI_CONFIG,
    ...userConfig,
  };

  const events: RivalAiEvent[] = [];
  const serverMessages: ServerMessage[] = [];
  let strike: RivalStrikeOutput | undefined;

  const currentTicks = state.ticksInCurrentState + 1;

  switch (state.state) {
    case "idle": {
      if (currentTicks < state.stateDurationTicks) {
        return {
          nextState: {
            ...state,
            ticksInCurrentState: currentTicks,
          },
          events,
          serverMessages,
        };
      }

      // Idle ended: plan next attack and enter telegraph.
      const actionType = selectRivalAction(
        rival,
        randomFn,
        config.specialProbability
      );
      const { initialPlan, comboQueue } = planRivalAttack(
        actionType,
        rival,
        randomFn,
        {
          specialTelegraphMs: config.specialTelegraphMs,
          specialDamage: config.specialDamage,
        }
      );

      const telegraphDurationTicks = msToTicks(initialPlan.telegraphMs);

      events.push({
        type: "telegraph",
        side: initialPlan.side,
        durationMs: initialPlan.telegraphMs,
        isSpecial: initialPlan.isSpecial,
      });

      const telegraphMsg: TelegraphMessage = {
        opcode: ServerOpcode.TELEGRAPH,
        side: initialPlan.side,
        attackerId: config.attackerId,
        durationMs: initialPlan.telegraphMs,
      };
      serverMessages.push(telegraphMsg);

      return {
        nextState: {
          state: "telegraph",
          ticksInCurrentState: 0,
          stateDurationTicks: telegraphDurationTicks,
          currentPlan: initialPlan,
          comboQueue,
          lastAttackType: actionType,
        },
        events,
        serverMessages,
      };
    }

    case "telegraph": {
      if (currentTicks < state.stateDurationTicks) {
        return {
          nextState: {
            ...state,
            ticksInCurrentState: currentTicks,
          },
          events,
          serverMessages,
        };
      }

      const plan = state.currentPlan;
      if (!plan) {
        // Fallback safety if no plan exists.
        return {
          nextState: {
            ...state,
            state: "idle",
            ticksInCurrentState: 0,
            stateDurationTicks: randomIdleDurationTicks(
              config.minIdleTicks,
              config.maxIdleTicks,
              randomFn
            ),
            currentPlan: null,
            comboQueue: [],
          },
          events,
          serverMessages,
        };
      }

      // Telegraph window expired.
      if (plan.isFeint) {
        events.push({
          type: "feint",
          side: plan.side,
        });

        const feintMsg: FeintMessage = {
          opcode: ServerOpcode.FEINT,
          side: plan.side,
          attackerId: config.attackerId,
        };
        serverMessages.push(feintMsg);

        return {
          nextState: {
            state: "recover",
            ticksInCurrentState: 0,
            stateDurationTicks: config.recoverTicks,
            currentPlan: null,
            comboQueue: [],
            lastAttackType: state.lastAttackType,
          },
          events,
          serverMessages,
        };
      }

      // Standard / special / combo strike execution.
      events.push({
        type: "strike",
        side: plan.side,
        damage: plan.damage,
        isSpecial: plan.isSpecial,
      });

      strike = {
        side: plan.side,
        damage: plan.damage,
        isSpecial: plan.isSpecial,
        attackerId: config.attackerId,
        targetId: config.targetId,
      };

      // Check if there are queued hits in combo.
      if (state.comboQueue.length > 0) {
        const nextHit = state.comboQueue[0];
        const remainingQueue = state.comboQueue.slice(1);
        const nextTelegraphTicks = msToTicks(nextHit.telegraphMs);

        events.push({
          type: "telegraph",
          side: nextHit.side,
          durationMs: nextHit.telegraphMs,
          isSpecial: nextHit.isSpecial,
        });

        const comboTelegraphMsg: TelegraphMessage = {
          opcode: ServerOpcode.TELEGRAPH,
          side: nextHit.side,
          attackerId: config.attackerId,
          durationMs: nextHit.telegraphMs,
        };
        serverMessages.push(comboTelegraphMsg);

        return {
          nextState: {
            state: "telegraph",
            ticksInCurrentState: 0,
            stateDurationTicks: nextTelegraphTicks,
            currentPlan: nextHit,
            comboQueue: remainingQueue,
            lastAttackType: state.lastAttackType,
          },
          events,
          strike,
          serverMessages,
        };
      }

      // No combo remaining -> transition to recover.
      return {
        nextState: {
          state: "recover",
          ticksInCurrentState: 0,
          stateDurationTicks: config.recoverTicks,
          currentPlan: null,
          comboQueue: [],
          lastAttackType: state.lastAttackType,
        },
        events,
        strike,
        serverMessages,
      };
    }

    case "strike": {
      // Immediate transition out of strike if state was set manually.
      return {
        nextState: {
          state: "recover",
          ticksInCurrentState: 0,
          stateDurationTicks: config.recoverTicks,
          currentPlan: null,
          comboQueue: [],
          lastAttackType: state.lastAttackType,
        },
        events,
        serverMessages,
      };
    }

    case "recover": {
      if (currentTicks < state.stateDurationTicks) {
        return {
          nextState: {
            ...state,
            ticksInCurrentState: currentTicks,
          },
          events,
          serverMessages,
        };
      }

      // Recover window ended -> return to idle.
      return {
        nextState: {
          state: "idle",
          ticksInCurrentState: 0,
          stateDurationTicks: randomIdleDurationTicks(
            config.minIdleTicks,
            config.maxIdleTicks,
            randomFn
          ),
          currentPlan: null,
          comboQueue: [],
          lastAttackType: state.lastAttackType,
        },
        events,
        serverMessages,
      };
    }

    default: {
      const _exhaustive: never = state.state;
      throw new Error(`Unhandled rival AI state: ${_exhaustive}`);
    }
  }
}

/**
 * Cancels active attack/telegraph and places AI into recovery window (e.g. after hit/stagger).
 */
export function interruptRivalAi(
  state: RivalAiState,
  recoveryTicks = DEFAULT_AI_CONFIG.recoverTicks
): RivalAiState {
  return {
    state: "recover",
    ticksInCurrentState: 0,
    stateDurationTicks: Math.max(1, recoveryTicks),
    currentPlan: null,
    comboQueue: [],
    lastAttackType: state.lastAttackType,
  };
}

/**
 * Stateful wrapper for managing Rival AI inside Nakama match loop.
 */
export class RivalAiEngine {
  private state: RivalAiState;
  private rival: Rival;
  private config: Required<RivalAiConfig>;
  private randomFn: () => number;

  constructor(
    rival: Rival,
    config?: Partial<RivalAiConfig>,
    randomFn: () => number = Math.random
  ) {
    this.rival = rival;
    this.config = {
      ...DEFAULT_AI_CONFIG,
      ...config,
    };
    this.randomFn = randomFn;
    this.state = createInitialRivalAiState(this.config.minIdleTicks);
  }

  public tick(): RivalAiTickResult {
    const result = tickRivalAi(
      this.state,
      this.rival,
      this.config,
      this.randomFn
    );
    this.state = result.nextState;
    return result;
  }

  public getState(): Readonly<RivalAiState> {
    return this.state;
  }

  public getRival(): Readonly<Rival> {
    return this.rival;
  }

  public interrupt(recoveryTicks?: number): void {
    this.state = interruptRivalAi(
      this.state,
      recoveryTicks ?? this.config.recoverTicks
    );
  }

  public reset(initialIdleTicks?: number): void {
    this.state = createInitialRivalAiState(
      initialIdleTicks ?? this.config.minIdleTicks
    );
  }
}

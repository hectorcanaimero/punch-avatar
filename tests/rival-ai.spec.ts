import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { RIVALS, type Rival } from "../src/data/rivals";
import { ServerOpcode } from "../src/protocol/opcodes";
import {
  createInitialRivalAiState,
  interruptRivalAi,
  planRivalAttack,
  RivalAiEngine,
  selectRivalAction,
  tickRivalAi,
} from "../src/matches/rival-ai";

describe("Rival AI - Action Selection & Planning", () => {
  const tito = RIVALS[0]; // Tito Cucharón: feint=0, combo=0, special=false
  const donaFierro = RIVALS[2]; // Doña Fierro: feint=0.1, combo=0.15, special=false
  const chancla = RIVALS[5]; // La Chancla Veloz: feint=0.2, combo=0.3, special=true

  test("rival sin feint ni combo (Tito) siempre elige punch", () => {
    for (let r = 0; r < 1; r += 0.1) {
      const action = selectRivalAction(tito, () => r);
      assert.equal(action, "punch");
    }
  });

  test("rival con feint/combo elige según thresholds de probabilidad", () => {
    // feintProbability = 0.1, comboProbability = 0.15
    // roll < 0.1 -> feint
    assert.equal(selectRivalAction(donaFierro, () => 0.05), "feint");
    // 0.1 <= roll < 0.25 -> combo
    assert.equal(selectRivalAction(donaFierro, () => 0.15), "combo");
    // roll >= 0.25 -> punch
    assert.equal(selectRivalAction(donaFierro, () => 0.5), "punch");
  });

  test("rival con especial (La Chancla) activa special si roll < specialProbability", () => {
    // usesSpecial=true, specialProbability=0.15
    const action = selectRivalAction(chancla, () => 0.05, 0.15);
    assert.equal(action, "special");
  });

  test("rival sin especial nunca activa special aunque el roll sea bajo", () => {
    const action = selectRivalAction(tito, () => 0.01, 0.15);
    assert.equal(action, "punch");
  });

  test("planRivalAttack genera plan correcto para golpe simple", () => {
    const { initialPlan, comboQueue } = planRivalAttack("punch", tito, () => 0.1);
    assert.equal(initialPlan.type, "punch");
    assert.equal(initialPlan.side, "left");
    assert.equal(initialPlan.damage, tito.damage);
    assert.equal(initialPlan.telegraphMs, tito.telegraphMs);
    assert.equal(initialPlan.isSpecial, false);
    assert.equal(initialPlan.isFeint, false);
    assert.equal(comboQueue.length, 0);
  });

  test("planRivalAttack genera plan correcto para feint", () => {
    const { initialPlan, comboQueue } = planRivalAttack("feint", donaFierro, () => 0.8);
    assert.equal(initialPlan.type, "feint");
    assert.equal(initialPlan.side, "right");
    assert.equal(initialPlan.damage, 0);
    assert.equal(initialPlan.telegraphMs, donaFierro.telegraphMs);
    assert.equal(initialPlan.isFeint, true);
    assert.equal(comboQueue.length, 0);
  });

  test("planRivalAttack genera plan correcto para especial", () => {
    const { initialPlan, comboQueue } = planRivalAttack("special", chancla, () => 0.2);
    assert.equal(initialPlan.type, "special");
    assert.equal(initialPlan.isSpecial, true);
    assert.equal(initialPlan.damage, 30);
    assert.equal(initialPlan.telegraphMs, 1000);
    assert.equal(comboQueue.length, 0);
  });

  test("planRivalAttack para combo genera 2 golpes en lados opuestos", () => {
    // randomFn=0.1 -> initial side is 'left', second side should be 'right'
    const { initialPlan, comboQueue } = planRivalAttack("combo", donaFierro, () => 0.1);
    assert.equal(initialPlan.type, "combo");
    assert.equal(initialPlan.side, "left");
    assert.equal(initialPlan.damage, donaFierro.damage);
    assert.equal(comboQueue.length, 1);

    const secondHit = comboQueue[0];
    assert.equal(secondHit.type, "combo");
    assert.equal(secondHit.side, "right");
    assert.equal(secondHit.damage, donaFierro.damage);
    assert.equal(secondHit.comboStep, 2);
    assert.equal(secondHit.totalComboSteps, 2);
  });
});

describe("Rival AI - FSM Lifecycle & Transitions", () => {
  const tito: Rival = {
    name: "Tito Cucharón",
    portraitUrl: "/assets/rivals/tito.webp",
    health: 80,
    damage: 5,
    telegraphMs: 300, // 3 ticks
    feintProbability: 0,
    comboProbability: 0,
    usesSpecial: false,
  };

  test("ciclo completo punch: idle -> telegraph -> strike -> recover -> idle", () => {
    let state = createInitialRivalAiState(2); // 2 ticks idle
    const config = {
      attackerId: "rival-1",
      targetId: "player-1",
      minIdleTicks: 2,
      maxIdleTicks: 2,
      recoverTicks: 2,
    };
    const deterministicRandom = () => 0.1; // punch left

    // Tick 1 (idle, count 1/2)
    let res = tickRivalAi(state, tito, config, deterministicRandom);
    assert.equal(res.nextState.state, "idle");
    assert.equal(res.events.length, 0);
    state = res.nextState;

    // Tick 2 (idle ended -> enters telegraph)
    res = tickRivalAi(state, tito, config, deterministicRandom);
    assert.equal(res.nextState.state, "telegraph");
    assert.equal(res.events.length, 1);
    assert.equal(res.events[0].type, "telegraph");
    assert.equal(res.events[0].side, "left");
    assert.equal(res.serverMessages.length, 1);
    assert.equal(res.serverMessages[0].opcode, ServerOpcode.TELEGRAPH);
    state = res.nextState;

    // Telegraph duration: 300ms = 3 ticks
    // Telegraph tick 1 (count 1/3)
    res = tickRivalAi(state, tito, config, deterministicRandom);
    assert.equal(res.nextState.state, "telegraph");
    state = res.nextState;

    // Telegraph tick 2 (count 2/3)
    res = tickRivalAi(state, tito, config, deterministicRandom);
    assert.equal(res.nextState.state, "telegraph");
    state = res.nextState;

    // Telegraph tick 3 (telegraph ended -> strike executed -> transitions to recover)
    res = tickRivalAi(state, tito, config, deterministicRandom);
    assert.equal(res.nextState.state, "recover");
    assert.ok(res.strike, "strike output must be present");
    assert.equal(res.strike?.damage, 5);
    assert.equal(res.strike?.side, "left");
    assert.equal(res.strike?.attackerId, "rival-1");
    assert.equal(res.strike?.targetId, "player-1");
    state = res.nextState;

    // Recover tick 1 (count 1/2)
    res = tickRivalAi(state, tito, config, deterministicRandom);
    assert.equal(res.nextState.state, "recover");
    state = res.nextState;

    // Recover tick 2 (recover ended -> transitions to idle)
    res = tickRivalAi(state, tito, config, deterministicRandom);
    assert.equal(res.nextState.state, "idle");
  });

  test("ciclo feint emite FEINT opcode sin strike", () => {
    const feintRival: Rival = {
      ...tito,
      feintProbability: 1.0, // 100% feint
    };
    let state = createInitialRivalAiState(1);
    const config = {
      attackerId: "rival-feinter",
      minIdleTicks: 1,
      maxIdleTicks: 1,
      recoverTicks: 2,
    };
    const deterministicRandom = () => 0.8; // side: right

    // Idle -> telegraph
    let res = tickRivalAi(state, feintRival, config, deterministicRandom);
    assert.equal(res.nextState.state, "telegraph");
    assert.equal(res.nextState.currentPlan?.isFeint, true);
    state = res.nextState;

    // Advance telegraph ticks (3 ticks for 300ms)
    res = tickRivalAi(state, feintRival, config, deterministicRandom); // 1
    state = res.nextState;
    res = tickRivalAi(state, feintRival, config, deterministicRandom); // 2
    state = res.nextState;
    res = tickRivalAi(state, feintRival, config, deterministicRandom); // 3 (expires)

    assert.equal(res.nextState.state, "recover");
    assert.equal(res.strike, undefined, "feint must not produce strike");
    assert.equal(res.events.length, 1);
    assert.equal(res.events[0].type, "feint");
    assert.equal(res.serverMessages.length, 1);
    assert.equal(res.serverMessages[0].opcode, ServerOpcode.FEINT);
  });

  test("ciclo combo encadena primer strike y segundo telegraph", () => {
    const comboRival: Rival = {
      ...tito,
      comboProbability: 1.0, // 100% combo
    };
    let state = createInitialRivalAiState(1);
    const config = {
      attackerId: "rival-combo",
      minIdleTicks: 1,
      maxIdleTicks: 1,
      recoverTicks: 2,
    };
    const deterministicRandom = () => 0.1; // initial side: left

    // Idle -> telegraph 1 (left)
    let res = tickRivalAi(state, comboRival, config, deterministicRandom);
    assert.equal(res.nextState.state, "telegraph");
    assert.equal(res.nextState.comboQueue.length, 1);
    state = res.nextState;

    // Advance telegraph 1 (3 ticks)
    res = tickRivalAi(state, comboRival, config, deterministicRandom); // 1
    state = res.nextState;
    res = tickRivalAi(state, comboRival, config, deterministicRandom); // 2
    state = res.nextState;
    res = tickRivalAi(state, comboRival, config, deterministicRandom); // 3 -> strike 1 + telegraph 2

    assert.equal(res.nextState.state, "telegraph", "must transition to telegraph for combo hit 2");
    assert.ok(res.strike, "first strike must trigger");
    assert.equal(res.strike?.side, "left");
    assert.equal(res.events.some((e) => e.type === "strike"), true);
    assert.equal(res.events.some((e) => e.type === "telegraph"), true);
    state = res.nextState;

    // Advance telegraph 2 (300 * 0.75 = 225ms -> 2 ticks)
    res = tickRivalAi(state, comboRival, config, deterministicRandom); // 1
    state = res.nextState;
    res = tickRivalAi(state, comboRival, config, deterministicRandom); // 2 -> strike 2 + recover

    assert.equal(res.nextState.state, "recover");
    assert.ok(res.strike, "second strike must trigger");
    assert.equal(res.strike?.side, "right");
  });

  test("ciclo especial emite strike con isSpecial=true y damage 30", () => {
    const specialRival: Rival = {
      ...tito,
      usesSpecial: true,
    };
    let state = createInitialRivalAiState(1);
    const config = {
      attackerId: "rival-boss",
      specialProbability: 1.0, // 100% special
      specialTelegraphMs: 200, // 2 ticks for fast test
      specialDamage: 30,
    };
    const deterministicRandom = () => 0.1;

    // Idle -> telegraph special
    let res = tickRivalAi(state, specialRival, config, deterministicRandom);
    assert.equal(res.nextState.state, "telegraph");
    assert.equal(res.nextState.currentPlan?.isSpecial, true);
    state = res.nextState;

    // Advance telegraph special (2 ticks)
    res = tickRivalAi(state, specialRival, config, deterministicRandom); // 1
    state = res.nextState;
    res = tickRivalAi(state, specialRival, config, deterministicRandom); // 2 -> strike special
    assert.equal(res.nextState.state, "recover");
    assert.ok(res.strike);
    assert.equal(res.strike?.isSpecial, true);
    assert.equal(res.strike?.damage, 30);
  });

  test("interruptRivalAi cancela ataque en curso y manda a recover", () => {
    let state = createInitialRivalAiState(1);
    const res = tickRivalAi(state, tito, { minIdleTicks: 1 }, () => 0.1);
    assert.equal(res.nextState.state, "telegraph");

    const interrupted = interruptRivalAi(res.nextState, 6);
    assert.equal(interrupted.state, "recover");
    assert.equal(interrupted.stateDurationTicks, 6);
    assert.equal(interrupted.currentPlan, null);
    assert.equal(interrupted.comboQueue.length, 0);
  });
});

describe("RivalAiEngine class wrapper", () => {
  test("RivalAiEngine expone métodos de lifecycle, interrupt y reset", () => {
    const tito = RIVALS[0];
    const engine = new RivalAiEngine(tito, {
      minIdleTicks: 1,
      maxIdleTicks: 1,
      recoverTicks: 2,
    });

    assert.equal(engine.getState().state, "idle");
    assert.equal(engine.getRival().name, "Tito Cucharón");

    // Tick to telegraph
    const tickResult = engine.tick();
    assert.equal(tickResult.nextState.state, "telegraph");
    assert.equal(engine.getState().state, "telegraph");

    // Interrupt
    engine.interrupt(4);
    assert.equal(engine.getState().state, "recover");
    assert.equal(engine.getState().stateDurationTicks, 4);

    // Reset
    engine.reset(2);
    assert.equal(engine.getState().state, "idle");
    assert.equal(engine.getState().stateDurationTicks, 2);
  });
});

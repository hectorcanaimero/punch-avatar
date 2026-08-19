import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { computeCareerUpdate } from "../src/hooks/postmatch-career.ts";
import { RIVALS } from "../src/data/rivals.ts";

const USER_ID = "user-alpha";

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Alpha",
    level: 3,
    xp: 500,
    wins: 5,
    losses: 2,
    kos: 1,
    careerProgress: 0,
    unlocks: [],
    ...overrides,
  };
}

describe("computeCareerUpdate — loss", () => {
  test("no toca careerProgress", () => {
    const profile = makeProfile({ careerProgress: 3 });
    const { updated, result } = computeCareerUpdate(profile, {
      userId: USER_ID,
      rivalIndex: 3,
      won: false,
    });
    assert.equal(updated.careerProgress, 3);
    assert.equal(result.advanced, false);
    assert.equal(result.wasFirstDefeat, false);
    assert.equal(result.careerProgressBefore, 3);
    assert.equal(result.careerProgressAfter, 3);
  });

  test("no marca champion aunque sea el último rival", () => {
    const profile = makeProfile({ careerProgress: RIVALS.length - 1 });
    const { result } = computeCareerUpdate(profile, {
      userId: USER_ID,
      rivalIndex: RIVALS.length - 1,
      won: false,
    });
    assert.equal(result.isFinalChampion, false);
    assert.equal(result.advanced, false);
  });
});

describe("computeCareerUpdate — win", () => {
  test("primer defeat del rival esperado avanza progress", () => {
    const profile = makeProfile({ careerProgress: 2 });
    const { updated, result } = computeCareerUpdate(profile, {
      userId: USER_ID,
      rivalIndex: 2,
      won: true,
    });
    assert.equal(updated.careerProgress, 3);
    assert.equal(result.advanced, true);
    assert.equal(result.wasFirstDefeat, true);
    assert.equal(result.careerProgressBefore, 2);
    assert.equal(result.careerProgressAfter, 3);
    assert.equal(result.isFinalChampion, false);
  });

  test("revancha (ganar a rival ya vencido) no avanza ni cuenta first defeat", () => {
    const profile = makeProfile({ careerProgress: 5 });
    const { updated, result } = computeCareerUpdate(profile, {
      userId: USER_ID,
      rivalIndex: 2, // ya vencido
      won: true,
    });
    assert.equal(updated.careerProgress, 5);
    assert.equal(result.advanced, false);
    assert.equal(result.wasFirstDefeat, false);
  });

  test("ganar al rival final marca isFinalChampion", () => {
    const lastIdx = RIVALS.length - 1;
    const profile = makeProfile({ careerProgress: lastIdx });
    const { updated, result } = computeCareerUpdate(profile, {
      userId: USER_ID,
      rivalIndex: lastIdx,
      won: true,
    });
    assert.equal(updated.careerProgress, RIVALS.length);
    assert.equal(result.isFinalChampion, true);
    assert.equal(result.advanced, true);
    assert.equal(result.wasFirstDefeat, true);
  });

  test("no supera RIVALS.length aunque llame de más", () => {
    // WHY: si por algún bug se re-llama post-champion, no puede overflow.
    const profile = makeProfile({ careerProgress: RIVALS.length });
    const { updated } = computeCareerUpdate(profile, {
      userId: USER_ID,
      rivalIndex: RIVALS.length - 1, // clampa dentro del rango
      won: true,
    });
    assert.equal(updated.careerProgress, RIVALS.length);
  });
});

describe("computeCareerUpdate — clamping", () => {
  test("rivalIndex negativo se clampa a 0", () => {
    const profile = makeProfile({ careerProgress: 0 });
    const { result } = computeCareerUpdate(profile, {
      userId: USER_ID,
      rivalIndex: -3,
      won: true,
    });
    assert.equal(result.rivalIndex, 0);
    assert.equal(result.advanced, true);
  });

  test("rivalIndex fuera del roster (top) se clampa al último", () => {
    const profile = makeProfile({ careerProgress: 0 });
    const { result } = computeCareerUpdate(profile, {
      userId: USER_ID,
      rivalIndex: 99,
      won: true,
    });
    assert.equal(result.rivalIndex, RIVALS.length - 1);
    // No es firstDefeat porque progressBefore=0 y clamped rivalIndex=last.
    assert.equal(result.wasFirstDefeat, false);
    assert.equal(result.advanced, false);
  });

  test("careerProgress no-numérico se trata como 0", () => {
    const profile = makeProfile({ careerProgress: "wat" as unknown as number });
    const { result } = computeCareerUpdate(profile, {
      userId: USER_ID,
      rivalIndex: 0,
      won: true,
    });
    assert.equal(result.careerProgressBefore, 0);
    assert.equal(result.advanced, true);
  });
});

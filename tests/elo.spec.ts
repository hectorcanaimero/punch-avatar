import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CLEAN_KO_BONUS,
  K_FACTOR,
  computeElo,
  computeExpectedScore,
  type EloResult,
} from "../src/lib/elo";

describe("computeExpectedScore", () => {
  test("ranks iguales → 0.5", () => {
    assert.equal(computeExpectedScore(1000, 1000), 0.5);
  });

  test("favorito (A mayor) → > 0.5", () => {
    assert.ok(computeExpectedScore(1200, 1000) > 0.5);
  });

  test("underdog (A menor) → < 0.5", () => {
    assert.ok(computeExpectedScore(1000, 1200) < 0.5);
  });

  test("simétrico: expected(A,B) + expected(B,A) = 1", () => {
    const a = computeExpectedScore(1345, 987);
    const b = computeExpectedScore(987, 1345);
    assert.ok(Math.abs(a + b - 1) < 1e-9);
  });

  test("siempre en [0, 1] y finito, incluso extremos", () => {
    for (const [a, b] of [
      [0, 100_000],
      [100_000, 0],
      [1234, 5678],
    ] as const) {
      const e = computeExpectedScore(a, b);
      assert.ok(Number.isFinite(e), `expected(${a}, ${b}) debe ser finito`);
      assert.ok(e >= 0 && e <= 1, `expected(${a}, ${b}) = ${e} fuera de [0,1]`);
    }
  });
});

describe("computeElo — simetría", () => {
  test("ranks iguales, A gana: +K/2 y -K/2", () => {
    const out = computeElo({ rankA: 1000, rankB: 1000, resultA: 1 });
    assert.equal(out.rankA, 1000 + K_FACTOR / 2);
    assert.equal(out.rankB, 1000 - K_FACTOR / 2);
  });

  test("lo que A sube, B lo baja (tol ±1 por redondeo entero)", () => {
    const cases: Array<[number, number]> = [
      [1000, 1000],
      [1200, 1000],
      [1000, 1200],
      [1500, 800],
      [900, 1300],
      [0, 3000],
    ];
    for (const [a, b] of cases) {
      const out = computeElo({ rankA: a, rankB: b, resultA: 1 });
      const gainA = out.rankA - a;
      const gainB = out.rankB - b;
      assert.ok(
        Math.abs(gainA + gainB) <= 1,
        `a=${a} b=${b}: gainA=${gainA} gainB=${gainB} (suma=${gainA + gainB})`,
      );
    }
  });

  test("empate no mueve ranks iguales", () => {
    const out = computeElo({ rankA: 1000, rankB: 1000, resultA: 0.5 });
    assert.equal(out.rankA, 1000);
    assert.equal(out.rankB, 1000);
  });

  test("empate favorece al de menor rank (underdog sube, favorito baja)", () => {
    const out = computeElo({ rankA: 1000, rankB: 1200, resultA: 0.5 });
    assert.ok(out.rankA > 1000);
    assert.ok(out.rankB < 1200);
  });
});

describe("computeElo — bonus K.O. limpio", () => {
  test("ganador recibe +CLEAN_KO_BONUS, perdedor sin penalidad extra", () => {
    const base = computeElo({ rankA: 1000, rankB: 1000, resultA: 1 });
    const ko = computeElo({
      rankA: 1000,
      rankB: 1000,
      resultA: 1,
      cleanKo: true,
    });
    assert.equal(ko.rankA, base.rankA + CLEAN_KO_BONUS);
    assert.equal(ko.rankB, base.rankB);
  });

  test("B gana con KO limpio: el bonus va a B, no a A", () => {
    const base = computeElo({ rankA: 1000, rankB: 1000, resultA: 0 });
    const ko = computeElo({
      rankA: 1000,
      rankB: 1000,
      resultA: 0,
      cleanKo: true,
    });
    assert.equal(ko.rankB, base.rankB + CLEAN_KO_BONUS);
    assert.equal(ko.rankA, base.rankA);
  });

  test("empate ignora cleanKo (no rompe simetría)", () => {
    const base = computeElo({ rankA: 1000, rankB: 1000, resultA: 0.5 });
    const ko = computeElo({
      rankA: 1000,
      rankB: 1000,
      resultA: 0.5,
      cleanKo: true,
    });
    assert.deepEqual(ko, base);
  });
});

describe("computeElo — extremos y clamp", () => {
  test("rank nunca baja de 0", () => {
    const out = computeElo({ rankA: 0, rankB: 0, resultA: 0 });
    assert.equal(out.rankA, 0);
    assert.equal(out.rankB, K_FACTOR / 2);
  });

  test("ranks gigantes no producen NaN ni Infinity", () => {
    const out = computeElo({ rankA: 1_000_000, rankB: 0, resultA: 0 });
    assert.ok(Number.isFinite(out.rankA));
    assert.ok(Number.isFinite(out.rankB));
  });

  test("underdog extremo que gana sube y no explota", () => {
    const out = computeElo({ rankA: 0, rankB: 1_000_000, resultA: 1 });
    assert.ok(Number.isFinite(out.rankA));
    assert.ok(Number.isFinite(out.rankB));
    assert.ok(out.rankA > 0);
  });

  test("override de K respeta el factor custom", () => {
    const out = computeElo({ rankA: 1000, rankB: 1000, resultA: 1, k: 40 });
    assert.equal(out.rankA, 1020);
    assert.equal(out.rankB, 980);
  });
});

describe("computeElo — validación de inputs", () => {
  test("rankA negativo → ELO_RANK_A_INVALID", () => {
    assert.throws(
      () => computeElo({ rankA: -1, rankB: 1000, resultA: 1 }),
      /ELO_RANK_A_INVALID/,
    );
  });

  test("rankB negativo → ELO_RANK_B_INVALID", () => {
    assert.throws(
      () => computeElo({ rankA: 1000, rankB: -5, resultA: 1 }),
      /ELO_RANK_B_INVALID/,
    );
  });

  test("result fuera de {0, 0.5, 1} → ELO_RESULT_INVALID", () => {
    assert.throws(
      () =>
        computeElo({
          rankA: 1000,
          rankB: 1000,
          resultA: 2 as unknown as EloResult,
        }),
      /ELO_RESULT_INVALID/,
    );
  });

  test("k <= 0 → ELO_K_INVALID", () => {
    assert.throws(
      () => computeElo({ rankA: 1000, rankB: 1000, resultA: 1, k: 0 }),
      /ELO_K_INVALID/,
    );
    assert.throws(
      () => computeElo({ rankA: 1000, rankB: 1000, resultA: 1, k: -3 }),
      /ELO_K_INVALID/,
    );
  });
});

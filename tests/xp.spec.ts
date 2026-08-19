import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { awardXp, levelFromXp, xpNeededForLevel } from "../src/lib/xp";

describe("awardXp", () => {
  test("victoria base = 50", () => {
    assert.equal(
      awardXp({ result: "win", cleanKo: false, firstCareerWin: false }),
      50,
    );
  });

  test("derrota base = 10", () => {
    assert.equal(
      awardXp({ result: "loss", cleanKo: false, firstCareerWin: false }),
      10,
    );
  });

  test("victoria + K.O. limpio = 70", () => {
    assert.equal(
      awardXp({ result: "win", cleanKo: true, firstCareerWin: false }),
      70,
    );
  });

  test("victoria + primera de carrera = 150", () => {
    assert.equal(
      awardXp({ result: "win", cleanKo: false, firstCareerWin: true }),
      150,
    );
  });

  test("victoria + KO limpio + primera de carrera = 170", () => {
    assert.equal(
      awardXp({ result: "win", cleanKo: true, firstCareerWin: true }),
      170,
    );
  });

  test("derrota con KO limpio y primera de carrera = 130", () => {
    assert.equal(
      awardXp({ result: "loss", cleanKo: true, firstCareerWin: true }),
      130,
    );
  });
});

describe("xpNeededForLevel", () => {
  test("nivel 1 = 100", () => {
    assert.equal(xpNeededForLevel(1), 100);
  });

  test("nivel 2 = 282", () => {
    assert.equal(xpNeededForLevel(2), 282);
  });

  test("crece monótonamente", () => {
    for (let n = 1; n < 20; n++) {
      assert.ok(
        xpNeededForLevel(n + 1) > xpNeededForLevel(n),
        `xpNeeded(${n + 1}) debería ser mayor que xpNeeded(${n})`,
      );
    }
  });

  test("nivel < 1 retorna 0", () => {
    assert.equal(xpNeededForLevel(0), 0);
    assert.equal(xpNeededForLevel(-3), 0);
  });
});

describe("levelFromXp", () => {
  test("0 XP = nivel 1", () => {
    assert.equal(levelFromXp(0), 1);
  });

  test("99 XP = nivel 1", () => {
    assert.equal(levelFromXp(99), 1);
  });

  test("100 XP = nivel 2", () => {
    assert.equal(levelFromXp(100), 2);
  });

  test("382 XP = nivel 3", () => {
    assert.equal(levelFromXp(382), 3);
  });

  test("XP negativo se trata como 0 → nivel 1", () => {
    assert.equal(levelFromXp(-50), 1);
  });

  test("inversa consistente: levelFromXp(xpNeeded acumulado) coincide", () => {
    // acumulado para nivel 4 = 100 + 282 + 519 = 901
    assert.equal(levelFromXp(100 + 282 + 519), 4);
    assert.equal(levelFromXp(100 + 282 + 519 - 1), 3);
  });
});

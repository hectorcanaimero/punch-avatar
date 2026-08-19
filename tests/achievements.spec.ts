import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  eligibleAchievements,
  verifyAchievements,
  type AchievementMatchResult,
} from "../src/lib/achievements";

const baseResult = (
  overrides: Partial<AchievementMatchResult> = {}
): AchievementMatchResult => ({
  won: true,
  ko: false,
  hitsReceived: 1,
  remainingHealth: 50,
  mode: "friendly",
  ...overrides,
});

describe("eligibleAchievements", () => {
  test("evalúa las cuatro condiciones de forma independiente", () => {
    assert.deepEqual(
      eligibleAchievements(
        baseResult({
          ko: true,
          hitsReceived: 0,
          remainingHealth: 9,
          mode: "career",
          careerRivalNumber: 10,
        })
      ),
      ["first_blood", "cara_de_piedra", "remontada", "campeon"]
    );
  });

  test("no otorga logros por una derrota", () => {
    assert.deepEqual(
      eligibleAchievements(
        baseResult({ won: false, ko: true, hitsReceived: 0, remainingHealth: 0 })
      ),
      []
    );
  });

  test("remontada exige menos de 10 HP y campeón exige rival 10 de Carrera", () => {
    assert.deepEqual(eligibleAchievements(baseResult({ remainingHealth: 10 })), []);
    assert.deepEqual(
      eligibleAchievements(baseResult({ mode: "ranked", careerRivalNumber: 10 })),
      []
    );
  });
});

describe("verifyAchievements", () => {
  test("solo escribe logros nuevos con creación condicional", () => {
    let writes: nkruntime.StorageWriteRequest[] = [];
    const nk = {
      storageRead: () => [{ key: "first_blood" }],
      storageWrite: (requests: nkruntime.StorageWriteRequest[]) => {
        writes = requests;
        return [];
      },
    } as unknown as nkruntime.Nakama;

    const awarded = verifyAchievements(
      nk,
      "user-1",
      baseResult({ ko: true, hitsReceived: 0 }),
      1234
    );

    assert.deepEqual(awarded, ["cara_de_piedra"]);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].key, "cara_de_piedra");
    assert.equal(writes[0].version, "*");
    assert.deepEqual(writes[0].value, {
      id: "cara_de_piedra",
      unlockedAt: 1234,
    });
  });

  test("una segunda verificación no vuelve a escribir", () => {
    let writeCalls = 0;
    const nk = {
      storageRead: () => [{ key: "first_blood" }],
      storageWrite: () => {
        writeCalls += 1;
        return [];
      },
    } as unknown as nkruntime.Nakama;

    assert.deepEqual(
      verifyAchievements(nk, "user-1", baseResult({ ko: true })),
      []
    );
    assert.equal(writeCalls, 0);
  });
});

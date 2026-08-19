import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PROFILE,
  calculateLevelProgress,
  calculateWinRate,
  ACHIEVEMENT_META,
  isAchievementUnlocked,
  getUnlockedAchievementsCount,
  formatProfileError,
} from "../client/src/screens/Profile";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_IDS,
  type AchievementId,
} from "../src/data/achievements";

describe("DEFAULT_PROFILE", () => {
  test("tiene los valores por defecto exactos según PRD §5", () => {
    assert.equal(DEFAULT_PROFILE.level, 1);
    assert.equal(DEFAULT_PROFILE.xp, 0);
    assert.equal(DEFAULT_PROFILE.wins, 0);
    assert.equal(DEFAULT_PROFILE.losses, 0);
    assert.equal(DEFAULT_PROFILE.kos, 0);
    assert.equal(DEFAULT_PROFILE.rankScore, 1000);
    assert.equal(DEFAULT_PROFILE.careerProgress, 0);
    assert.deepEqual(DEFAULT_PROFILE.unlocks, []);
    assert.equal(DEFAULT_PROFILE.avatarUrl, null);
    assert.equal(DEFAULT_PROFILE.avatarStyle, null);
  });
});

describe("calculateLevelProgress", () => {
  test("calcula el progreso en nivel 1 con 0 XP", () => {
    const p = calculateLevelProgress(0);
    assert.equal(p.level, 1);
    assert.equal(p.totalXp, 0);
    assert.equal(p.currentLevelXp, 0);
    assert.equal(p.neededForNextLevel, 100);
    assert.equal(p.progressPercent, 0);
    assert.equal(p.remainingXp, 100);
  });

  test("calcula el progreso a mitad de nivel 1 (50 XP)", () => {
    const p = calculateLevelProgress(50);
    assert.equal(p.level, 1);
    assert.equal(p.totalXp, 50);
    assert.equal(p.currentLevelXp, 50);
    assert.equal(p.neededForNextLevel, 100);
    assert.equal(p.progressPercent, 50);
    assert.equal(p.remainingXp, 50);
  });

  test("calcula el paso exacto al nivel 2 (100 XP)", () => {
    const p = calculateLevelProgress(100);
    assert.equal(p.level, 2);
    assert.equal(p.totalXp, 100);
    assert.equal(p.currentLevelXp, 0);
    assert.equal(p.neededForNextLevel, 282);
    assert.equal(p.progressPercent, 0);
    assert.equal(p.remainingXp, 282);
  });

  test("calcula progreso intermedio en nivel 2 (241 XP → 50%)", () => {
    // 100 (nivel 1) + 141 (mitad de 282) = 241 XP
    const p = calculateLevelProgress(241);
    assert.equal(p.level, 2);
    assert.equal(p.totalXp, 241);
    assert.equal(p.currentLevelXp, 141);
    assert.equal(p.neededForNextLevel, 282);
    assert.equal(p.progressPercent, 50);
    assert.equal(p.remainingXp, 141);
  });

  test("calcula el inicio del nivel 3 (382 XP)", () => {
    // 100 (nivel 1) + 282 (nivel 2) = 382 XP
    const p = calculateLevelProgress(382);
    assert.equal(p.level, 3);
    assert.equal(p.totalXp, 382);
    assert.equal(p.currentLevelXp, 0);
    assert.equal(p.remainingXp, p.neededForNextLevel);
    assert.equal(p.progressPercent, 0);
  });

  test("clampea XP negativo a 0", () => {
    const p = calculateLevelProgress(-100);
    assert.equal(p.level, 1);
    assert.equal(p.totalXp, 0);
    assert.equal(p.currentLevelXp, 0);
  });

  test("respeta explicitLevel si es mayor", () => {
    const p = calculateLevelProgress(0, 5);
    assert.equal(p.level, 5);
  });
});

describe("calculateWinRate", () => {
  test("retorna 0 si no hay combates", () => {
    assert.equal(calculateWinRate(0, 0), 0);
  });

  test("retorna 50% con balance parejo (5-5)", () => {
    assert.equal(calculateWinRate(5, 5), 50);
  });

  test("retorna 100% con victorias puras (10-0)", () => {
    assert.equal(calculateWinRate(10, 0), 100);
  });

  test("retorna 75% con 3 victorias y 1 derrota", () => {
    assert.equal(calculateWinRate(3, 1), 75);
  });

  test("retorna 0% con 0 victorias y 5 derrotas", () => {
    assert.equal(calculateWinRate(0, 5), 0);
  });
});

describe("ACHIEVEMENT_META", () => {
  test("cubre exactamente todos los logros de ACHIEVEMENT_IDS", () => {
    const keys = Object.keys(ACHIEVEMENT_META) as AchievementId[];
    assert.equal(keys.length, ACHIEVEMENT_IDS.length);
    for (const id of ACHIEVEMENT_IDS) {
      assert.ok(ACHIEVEMENT_META[id], `Falta logro ${id} en ACHIEVEMENT_META`);
      assert.equal(ACHIEVEMENT_META[id].id, id);
    }
  });

  test("cada logro contiene metadata completa y válida", () => {
    for (const ach of ACHIEVEMENTS) {
      const meta = ACHIEVEMENT_META[ach.id];
      assert.ok(meta.name.length > 0, `name vacío en ${ach.id}`);
      assert.ok(meta.description.length > 0, `description vacía en ${ach.id}`);
      assert.ok(meta.icon.length > 0, `icon vacío en ${ach.id}`);
      assert.ok(meta.accentColor.startsWith("#"), `accentColor inválido en ${ach.id}`);
      assert.ok(meta.badge.length > 0, `badge vacío en ${ach.id}`);
      assert.equal(meta.name, ach.name);
      assert.equal(meta.description, ach.description);
    }
  });
});

describe("isAchievementUnlocked y getUnlockedAchievementsCount", () => {
  test("identifica correctamente logros desbloqueados con Set", () => {
    const unlockedSet = new Set<string>(["first_blood", "remontada"]);
    assert.equal(isAchievementUnlocked("first_blood", unlockedSet), true);
    assert.equal(isAchievementUnlocked("remontada", unlockedSet), true);
    assert.equal(isAchievementUnlocked("cara_de_piedra", unlockedSet), false);
    assert.equal(isAchievementUnlocked("campeon", unlockedSet), false);

    const stats = getUnlockedAchievementsCount(unlockedSet);
    assert.equal(stats.unlocked, 2);
    assert.equal(stats.total, 4);
    assert.equal(stats.percentage, 50);
  });

  test("identifica correctamente logros desbloqueados con Array", () => {
    const unlockedArray = ["cara_de_piedra"];
    assert.equal(isAchievementUnlocked("cara_de_piedra", unlockedArray), true);
    assert.equal(isAchievementUnlocked("first_blood", unlockedArray), false);

    const stats = getUnlockedAchievementsCount(unlockedArray);
    assert.equal(stats.unlocked, 1);
    assert.equal(stats.total, 4);
    assert.equal(stats.percentage, 25);
  });

  test("calcula 0% cuando ningún logro está desbloqueado", () => {
    const stats = getUnlockedAchievementsCount([]);
    assert.equal(stats.unlocked, 0);
    assert.equal(stats.total, 4);
    assert.equal(stats.percentage, 0);
  });

  test("calcula 100% cuando todos los logros están desbloqueados", () => {
    const stats = getUnlockedAchievementsCount(ACHIEVEMENT_IDS);
    assert.equal(stats.unlocked, 4);
    assert.equal(stats.total, 4);
    assert.equal(stats.percentage, 100);
  });
});

describe("formatProfileError", () => {
  test("formatea mensajes comprensibles en español", () => {
    assert.ok(
      formatProfileError(new Error("401 Unauthorized")).includes("sesión venció")
    );
    assert.ok(
      formatProfileError("UNAUTHENTICATED").includes("sesión venció")
    );
    assert.ok(
      formatProfileError("PROFILE_NOT_FOUND").includes("No encontramos el perfil")
    );
    assert.ok(
      formatProfileError("NETWORK_TIMEOUT").includes("No pudimos cargar")
    );
  });
});

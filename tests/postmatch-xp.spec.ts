import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeProfileUpdate } from "../src/hooks/postmatch-xp";

const baseProfile = {
  displayName: "hector",
  avatarUrl: null,
  avatarStyle: null,
  level: 1,
  xp: 0,
  wins: 0,
  losses: 0,
  kos: 0,
  rankScore: 1000,
  careerProgress: 0,
  unlocks: ["gloves_red", "style_pixar_3d", "phrase_pow", "phrase_bonk"],
};

describe("computeProfileUpdate", () => {
  test("victoria simple: +50 XP, wins++, sin level up", () => {
    const { updated, result } = computeProfileUpdate(baseProfile, {
      userId: "u",
      result: "win",
      cleanKo: false,
      firstCareerWin: false,
    });
    assert.equal(result.xpAwarded, 50);
    assert.equal(result.totalXp, 50);
    assert.equal(result.oldLevel, 1);
    assert.equal(result.newLevel, 1);
    assert.equal(result.levelUps, 0);
    assert.equal(updated.wins, 1);
    assert.equal(updated.losses, 0);
    assert.equal(updated.kos, 0);
    assert.deepEqual(result.newUnlocks, []);
  });

  test("derrota: +10 XP, losses++, kos igual", () => {
    const { updated, result } = computeProfileUpdate(baseProfile, {
      userId: "u",
      result: "loss",
      cleanKo: false,
      firstCareerWin: false,
    });
    assert.equal(result.xpAwarded, 10);
    assert.equal(updated.wins, 0);
    assert.equal(updated.losses, 1);
    assert.equal(updated.kos, 0);
  });

  test("clean KO en victoria: +50+20 XP, kos++", () => {
    const { updated, result } = computeProfileUpdate(baseProfile, {
      userId: "u",
      result: "win",
      cleanKo: true,
      firstCareerWin: false,
    });
    assert.equal(result.xpAwarded, 70);
    assert.equal(updated.wins, 1);
    assert.equal(updated.kos, 1);
  });

  test("clean KO en derrota (edge): bonus XP sí, kos NO (kos requiere win)", () => {
    const { updated, result } = computeProfileUpdate(baseProfile, {
      userId: "u",
      result: "loss",
      cleanKo: true,
      firstCareerWin: false,
    });
    assert.equal(result.xpAwarded, 30);
    assert.equal(updated.losses, 1);
    assert.equal(updated.kos, 0);
  });

  test("primera victoria de carrera: +50+100 = 150 XP y sube nivel", () => {
    const { updated, result } = computeProfileUpdate(baseProfile, {
      userId: "u",
      result: "win",
      cleanKo: false,
      firstCareerWin: true,
    });
    assert.equal(result.xpAwarded, 150);
    assert.equal(result.totalXp, 150);
    // xpNeededForLevel(1)=100 → 150 - 100 = 50 remaining, level 2
    // xpNeededForLevel(2)=282 > 50 → detiene en level 2
    assert.equal(result.newLevel, 2);
    assert.equal(result.levelUps, 1);
    assert.equal(updated.level, 2);
    // unlocksAtLevel(2) = [phrase_zas] — nuevo
    assert.deepEqual(result.newUnlocks, ["phrase_zas"]);
    assert.ok((updated.unlocks as string[]).includes("phrase_zas"));
  });

  test("acumula unlocks al pasar varios niveles de una", () => {
    // startXp muy alto: level start=1, awardXp=150, totalXp=1250
    // 100+282+519+800 = 1701 → hasta level 4; 1250 alcanza para level 3+parte
    // Verificamos que unlocks entre level 2..N se acumulan sin duplicar
    const rich = { ...baseProfile, xp: 1100 }; // starts at level 1 con 1100 xp acumulado
    const { updated, result } = computeProfileUpdate(rich, {
      userId: "u",
      result: "win",
      cleanKo: true,
      firstCareerWin: true,
    });
    // xpAwarded: 50+20+100 = 170; total 1270
    assert.equal(result.xpAwarded, 170);
    assert.equal(result.totalXp, 1270);
    assert.ok(result.newLevel >= 3, `newLevel=${result.newLevel}`);
    // Debe incluir al menos phrase_zas (L2), phrase_cataplum y gloves_blue (L3)
    assert.ok(result.newUnlocks.includes("phrase_zas"));
    assert.ok(result.newUnlocks.includes("gloves_blue"));
    assert.ok(result.newUnlocks.includes("phrase_cataplum"));
  });

  test("no duplica unlocks ya poseídos", () => {
    const already = {
      ...baseProfile,
      xp: 90,
      unlocks: [...baseProfile.unlocks, "phrase_zas"], // ya tenía L2
    };
    const { result } = computeProfileUpdate(already, {
      userId: "u",
      result: "win",
      cleanKo: false,
      firstCareerWin: false,
    });
    // 90+50=140 → level 2, pero phrase_zas ya está → newUnlocks vacío
    assert.equal(result.newLevel, 2);
    assert.deepEqual(result.newUnlocks, []);
  });

  test("perfil sin xp ni level definidos: defaults a 0 xp / level 1", () => {
    const empty = { displayName: "nuevo" };
    const { updated, result } = computeProfileUpdate(empty, {
      userId: "u",
      result: "win",
      cleanKo: false,
      firstCareerWin: false,
    });
    assert.equal(result.oldLevel, 1);
    assert.equal(result.totalXp, 50);
    assert.equal(updated.level, 1);
    assert.equal(updated.xp, 50);
    assert.equal(updated.wins, 1);
  });

  test("perfil sin array unlocks: arranca desde []", () => {
    const noUnlocks = { level: 1, xp: 90 };
    const { updated, result } = computeProfileUpdate(noUnlocks, {
      userId: "u",
      result: "win",
      cleanKo: false,
      firstCareerWin: false,
    });
    // 90+50=140 → level 2, phrase_zas nuevo
    assert.equal(result.newLevel, 2);
    assert.deepEqual(result.newUnlocks, ["phrase_zas"]);
    assert.deepEqual(updated.unlocks, ["phrase_zas"]);
  });

  test("preserva campos ajenos del perfil (avatarUrl, rankScore, etc.)", () => {
    const { updated } = computeProfileUpdate(baseProfile, {
      userId: "u",
      result: "win",
      cleanKo: false,
      firstCareerWin: false,
    });
    assert.equal(updated.displayName, "hector");
    assert.equal(updated.rankScore, 1000);
    assert.equal(updated.careerProgress, 0);
  });
});

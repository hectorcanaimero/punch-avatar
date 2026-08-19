import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  TIERS,
  getTierFromScore,
  WIDENING_STAGES,
  getWideningStage,
  calculateRangeBounds,
  formatSearchTime,
  formatRankedSearchError,
} from "../client/src/screens/RankedSearch";

describe("getTierFromScore", () => {
  test("categoriza correctamente los tiers según PRD §6 y Spec 07", () => {
    // Bronce: 0 - 999
    assert.equal(getTierFromScore(0).id, "bronce");
    assert.equal(getTierFromScore(500).id, "bronce");
    assert.equal(getTierFromScore(999).id, "bronce");

    // Plata: 1000 - 1399
    assert.equal(getTierFromScore(1000).id, "plata");
    assert.equal(getTierFromScore(1250).id, "plata");
    assert.equal(getTierFromScore(1399).id, "plata");

    // Oro: 1400 - 1799
    assert.equal(getTierFromScore(1400).id, "oro");
    assert.equal(getTierFromScore(1600).id, "oro");
    assert.equal(getTierFromScore(1799).id, "oro");

    // Leyenda Tonta: 1800+
    assert.equal(getTierFromScore(1800).id, "leyenda_tonta");
    assert.equal(getTierFromScore(2200).id, "leyenda_tonta");
    assert.equal(getTierFromScore(5000).id, "leyenda_tonta");
  });

  test("maneja números negativos o decimales clampeando con seguridad", () => {
    assert.equal(getTierFromScore(-100).id, "bronce");
    assert.equal(getTierFromScore(999.9).id, "bronce");
    assert.equal(getTierFromScore(1000.5).id, "plata");
    assert.equal(getTierFromScore(NaN).id, "bronce");
  });

  test("todos los tiers tienen metadatos completos y colores legibles", () => {
    for (const key of Object.keys(TIERS) as Array<keyof typeof TIERS>) {
      const tier = TIERS[key];
      assert.ok(tier.name.length > 0, `name vacío en tier ${key}`);
      assert.ok(tier.badge.length > 0, `badge vacío en tier ${key}`);
      assert.ok(tier.color.startsWith("#"), `color no hex en tier ${key}`);
      assert.ok(tier.accentBg.startsWith("#"), `accentBg no hex en tier ${key}`);
      assert.ok(tier.rangeLabel.length > 0, `rangeLabel vacío en tier ${key}`);
      assert.ok(tier.description.length > 0, `description vacía en tier ${key}`);
    }
  });
});

describe("getWideningStage", () => {
  test("clasifica las 3 etapas temporales de búsqueda (0-9s, 10-19s, 20s+)", () => {
    // Etapa 1: ±150 (0-9s)
    assert.equal(getWideningStage(0).stageNumber, 1);
    assert.equal(getWideningStage(0).range, 150);
    assert.equal(getWideningStage(5).stageNumber, 1);
    assert.equal(getWideningStage(9).stageNumber, 1);

    // Etapa 2: ±250 (10-19s)
    assert.equal(getWideningStage(10).stageNumber, 2);
    assert.equal(getWideningStage(10).range, 250);
    assert.equal(getWideningStage(15).stageNumber, 2);
    assert.equal(getWideningStage(19).stageNumber, 2);

    // Etapa 3: ±400 (20s+)
    assert.equal(getWideningStage(20).stageNumber, 3);
    assert.equal(getWideningStage(20).range, 400);
    assert.equal(getWideningStage(29).stageNumber, 3);
    assert.equal(getWideningStage(30).stageNumber, 3);
    assert.equal(getWideningStage(60).stageNumber, 3);
  });

  test("WIDENING_STAGES define 3 etapas ordenadas", () => {
    assert.equal(WIDENING_STAGES.length, 3);
    assert.equal(WIDENING_STAGES[0].range, 150);
    assert.equal(WIDENING_STAGES[1].range, 250);
    assert.equal(WIDENING_STAGES[2].range, 400);
  });
});

describe("calculateRangeBounds", () => {
  test("calcula cotas inferiores y superiores simétricas", () => {
    const bounds = calculateRangeBounds(1000, 150);
    assert.equal(bounds.min, 850);
    assert.equal(bounds.max, 1150);
  });

  test("nunca permite cotas mínimas negativas", () => {
    const bounds = calculateRangeBounds(50, 150);
    assert.equal(bounds.min, 0);
    assert.equal(bounds.max, 200);
  });

  test("calcula cotas ampliadas para rangos 250 y 400", () => {
    const stage2 = calculateRangeBounds(1200, 250);
    assert.equal(stage2.min, 950);
    assert.equal(stage2.max, 1450);

    const stage3 = calculateRangeBounds(1800, 400);
    assert.equal(stage3.min, 1400);
    assert.equal(stage3.max, 2200);
  });
});

describe("formatSearchTime", () => {
  test("formatea segundos a mm:ss con padding", () => {
    assert.equal(formatSearchTime(0), "00:00");
    assert.equal(formatSearchTime(4), "00:04");
    assert.equal(formatSearchTime(15), "00:15");
    assert.equal(formatSearchTime(30), "00:30");
    assert.equal(formatSearchTime(60), "01:00");
    assert.equal(formatSearchTime(85), "01:25");
  });

  test("maneja valores negativos clampeando a 0", () => {
    assert.equal(formatSearchTime(-10), "00:00");
  });
});

describe("formatRankedSearchError", () => {
  test("traduce errores de autenticación", () => {
    const msg = formatRankedSearchError(new Error("401 Unauthorized"));
    assert.ok(msg.includes("sesión"));
  });

  test("traduce errores de rank inválido", () => {
    const msg = formatRankedSearchError(new Error("RANK_SCORE_INVALID"));
    assert.ok(msg.includes("puntuación de rango"));
  });

  test("traduce errores de desconexión del socket", () => {
    const msg = formatRankedSearchError(new Error("SOCKET_CLOSED"));
    assert.ok(msg.includes("conexión"));
  });

  test("maneja errores genéricos con mensaje amigable", () => {
    const msg = formatRankedSearchError("RANDOM_FAIL");
    assert.ok(msg.includes("error al buscar partida"));
  });
});

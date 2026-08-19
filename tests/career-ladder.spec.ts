import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyRival,
  formatCareerError,
  isCareerCompleted,
  normalizeCareerProgress,
  parseCareerStartResponse,
} from "../client/src/lib/career-ladder.ts";

describe("normalizeCareerProgress", () => {
  test("devuelve el entero de un número finito", () => {
    assert.equal(normalizeCareerProgress(0), 0);
    assert.equal(normalizeCareerProgress(3), 3);
    assert.equal(normalizeCareerProgress(2.9), 2);
  });

  test("clampea negativos a 0", () => {
    assert.equal(normalizeCareerProgress(-1), 0);
    assert.equal(normalizeCareerProgress(-999), 0);
  });

  test("no-números default a 0", () => {
    assert.equal(normalizeCareerProgress(undefined), 0);
    assert.equal(normalizeCareerProgress(null), 0);
    assert.equal(normalizeCareerProgress("3"), 0);
    assert.equal(normalizeCareerProgress(NaN), 0);
    assert.equal(normalizeCareerProgress(Infinity), 0);
  });
});

describe("classifyRival", () => {
  test("rivales anteriores al progreso están vencidos", () => {
    assert.equal(classifyRival(0, 3), "beaten");
    assert.equal(classifyRival(2, 3), "beaten");
  });

  test("el rival en el índice de progreso es el actual", () => {
    assert.equal(classifyRival(3, 3), "current");
    assert.equal(classifyRival(0, 0), "current");
  });

  test("rivales posteriores al progreso están bloqueados", () => {
    assert.equal(classifyRival(4, 3), "locked");
    assert.equal(classifyRival(9, 3), "locked");
  });

  test("con progreso 0 solo el primero es actual", () => {
    assert.equal(classifyRival(0, 0), "current");
    assert.equal(classifyRival(1, 0), "locked");
  });

  test("progreso negativo se clampa a 0", () => {
    assert.equal(classifyRival(0, -5), "current");
    assert.equal(classifyRival(1, -5), "locked");
  });
});

describe("isCareerCompleted", () => {
  test("no completado cuando progreso < total", () => {
    assert.equal(isCareerCompleted(5, 10), false);
    assert.equal(isCareerCompleted(0, 10), false);
  });

  test("completado cuando progreso >= total", () => {
    assert.equal(isCareerCompleted(10, 10), true);
    assert.equal(isCareerCompleted(12, 10), true);
  });

  test("total 0 nunca está completado (defensivo)", () => {
    assert.equal(isCareerCompleted(0, 0), false);
  });
});

describe("parseCareerStartResponse", () => {
  test("parsea payload string JSON", () => {
    const raw = JSON.stringify({
      matchId: "m-123",
      rival: {
        index: 2,
        name: "Doña Fierro",
        portraitUrl: "/assets/rivals/dona-fierro.webp",
        health: 100,
      },
      careerProgress: 2,
      totalRivals: 10,
    });
    const result = parseCareerStartResponse(raw);
    assert.equal(result.matchId, "m-123");
    assert.equal(result.rival.name, "Doña Fierro");
    assert.equal(result.rival.index, 2);
    assert.equal(result.careerProgress, 2);
    assert.equal(result.totalRivals, 10);
  });

  test("parsea payload objeto ya deserializado", () => {
    const result = parseCareerStartResponse({
      matchId: "m-456",
      rival: { index: 0, name: "Tito Cucharón", portraitUrl: "", health: 80 },
      careerProgress: 0,
      totalRivals: 10,
    });
    assert.equal(result.matchId, "m-456");
    assert.equal(result.rival.name, "Tito Cucharón");
  });

  test("lanza CAREER_RESPONSE_INVALID sin matchId", () => {
    assert.throws(
      () => parseCareerStartResponse({ rival: { name: "x" } }),
      /CAREER_RESPONSE_INVALID/
    );
    assert.throws(() => parseCareerStartResponse(null), /CAREER_RESPONSE_INVALID/);
    assert.throws(() => parseCareerStartResponse("not json"), /CAREER_RESPONSE_INVALID/);
  });

  test("rival con datos faltantes usa defaults defensivos", () => {
    const result = parseCareerStartResponse({
      matchId: "m-789",
      rival: {},
      careerProgress: "5",
      totalRivals: "10",
    });
    assert.equal(result.rival.name, "Rival");
    assert.equal(result.rival.portraitUrl, "");
    assert.equal(result.rival.health, 0);
    assert.equal(result.careerProgress, 0);
    assert.equal(result.totalRivals, 0);
  });
});

describe("formatCareerError", () => {
  test("mapea errores conocidos a copy amigable", () => {
    assert.ok(formatCareerError(new Error("AUTH_REQUIRED")).includes("sesión"));
    assert.ok(formatCareerError("PROFILE_NOT_FOUND").includes("perfil"));
    assert.ok(formatCareerError("CAREER_COMPLETED").includes("campeón"));
    assert.ok(formatCareerError("CAREER_RESPONSE_INVALID").includes("respuesta"));
    assert.ok(formatCareerError("401 Unauthorized").includes("sesión"));
  });

  test("errores desconocidos caen al mensaje genérico", () => {
    assert.ok(formatCareerError("NETWORK_DOWN").includes("No pudimos arrancar"));
  });
});

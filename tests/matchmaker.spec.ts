import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildRankQuery } from "../client/src/lib/matchmaker.ts";
import { isValidRankedPair } from "../src/matchmaker/config.ts";

describe("ranked matchmaker", () => {
  test("construye bounds iniciales alrededor del rank", () => {
    assert.equal(
      buildRankQuery(1000, 150),
      "+properties.rankScore:>=850 +properties.rankScore:<=1150",
    );
  });

  test("nunca genera un rank mínimo negativo", () => {
    assert.equal(
      buildRankQuery(50, 150),
      "+properties.rankScore:>=0 +properties.rankScore:<=200",
    );
  });

  test("rechaza parámetros inválidos", () => {
    assert.throws(() => buildRankQuery(NaN, 150), /RANK_SCORE_INVALID/);
    assert.throws(() => buildRankQuery(1000, 0), /RANK_RANGE_INVALID/);
  });

  test("acepta solo dos ranks autoritativos a distancia máxima 400", () => {
    assert.equal(isValidRankedPair([1000, 1400]), true);
    assert.equal(isValidRankedPair([1000, 1401]), false);
    assert.equal(isValidRankedPair([1000]), false);
    assert.equal(isValidRankedPair([1000, NaN]), false);
  });
});

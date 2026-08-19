import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { tierFromScore } from "../src/lib/tier.ts";

describe("tierFromScore", () => {
  test("respeta los límites de cada tier", () => {
    assert.equal(tierFromScore(0), "Bronce");
    assert.equal(tierFromScore(999), "Bronce");
    assert.equal(tierFromScore(1000), "Plata");
    assert.equal(tierFromScore(1399), "Plata");
    assert.equal(tierFromScore(1400), "Oro");
    assert.equal(tierFromScore(1799), "Oro");
    assert.equal(tierFromScore(1800), "Leyenda Tonta");
    assert.equal(tierFromScore(9000), "Leyenda Tonta");
  });

  test("normaliza scores negativos y no finitos a Bronce", () => {
    assert.equal(tierFromScore(-1), "Bronce");
    assert.equal(tierFromScore(Number.NaN), "Bronce");
    assert.equal(tierFromScore(Number.POSITIVE_INFINITY), "Bronce");
  });
});

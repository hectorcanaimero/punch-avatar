import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { pickCareerRival } from "../src/rpcs/start_career_match";
import { RIVALS } from "../src/data/rivals";

describe("pickCareerRival", () => {
  test("careerProgress=0 → primer rival del roster", () => {
    const pick = pickCareerRival(0);
    assert.equal(pick.rivalIndex, 0);
    assert.equal(pick.rival.name, RIVALS[0].name);
    assert.equal(pick.careerProgress, 0);
    assert.equal(pick.totalRivals, RIVALS.length);
  });

  test("careerProgress=3 → cuarto rival", () => {
    const pick = pickCareerRival(3);
    assert.equal(pick.rivalIndex, 3);
    assert.equal(pick.rival.name, RIVALS[3].name);
  });

  test("careerProgress=undefined default a 0", () => {
    assert.equal(pickCareerRival(undefined).rivalIndex, 0);
  });

  test("careerProgress no-number default a 0", () => {
    assert.equal(pickCareerRival("3" as unknown).rivalIndex, 0);
    assert.equal(pickCareerRival(null).rivalIndex, 0);
    assert.equal(pickCareerRival(NaN).rivalIndex, 0);
    assert.equal(pickCareerRival(Infinity).rivalIndex, 0);
  });

  test("careerProgress negativo se clampa a 0 (defensivo)", () => {
    assert.equal(pickCareerRival(-1).rivalIndex, 0);
    assert.equal(pickCareerRival(-999).rivalIndex, 0);
  });

  test("careerProgress fraccional se trunca hacia abajo", () => {
    assert.equal(pickCareerRival(2.7).rivalIndex, 2);
    assert.equal(pickCareerRival(2.1).rivalIndex, 2);
  });

  test("careerProgress igual a RIVALS.length → CAREER_COMPLETED", () => {
    assert.throws(
      () => pickCareerRival(RIVALS.length),
      /CAREER_COMPLETED/,
    );
  });

  test("careerProgress mayor que RIVALS.length → CAREER_COMPLETED", () => {
    assert.throws(
      () => pickCareerRival(RIVALS.length + 5),
      /CAREER_COMPLETED/,
    );
  });

  test("careerProgress=último index válido no lanza (aún queda ese rival)", () => {
    const last = RIVALS.length - 1;
    const pick = pickCareerRival(last);
    assert.equal(pick.rivalIndex, last);
    assert.equal(pick.rival.name, RIVALS[last].name);
  });

  test("response incluye todos los campos esperados por el cliente", () => {
    const pick = pickCareerRival(2);
    assert.ok(pick.rival.name);
    assert.ok(pick.rival.portraitUrl);
    assert.equal(typeof pick.rival.health, "number");
    assert.equal(typeof pick.rivalIndex, "number");
    assert.equal(typeof pick.careerProgress, "number");
    assert.equal(pick.totalRivals, 10);
  });
});

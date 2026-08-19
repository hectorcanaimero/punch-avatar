import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateUsername } from "../src/lib/username";

describe("validateUsername", () => {
  test("acepta mínimo 3 chars", () => {
    assert.deepEqual(validateUsername("bob"), { valid: true, reason: "ok" });
  });

  test("acepta máximo 20 chars", () => {
    assert.deepEqual(validateUsername("a".repeat(20)), {
      valid: true,
      reason: "ok",
    });
  });

  test("acepta alfanumérico con mayúsculas y números", () => {
    assert.deepEqual(validateUsername("PunchBoxer88"), {
      valid: true,
      reason: "ok",
    });
  });

  test("rechaza vacío y menor a 3 chars", () => {
    assert.equal(validateUsername("").valid, false);
    assert.equal(validateUsername("").reason, "too_short");
    assert.equal(validateUsername("ab").valid, false);
    assert.equal(validateUsername("ab").reason, "too_short");
  });

  test("rechaza mayor a 20 chars", () => {
    const long = "a".repeat(21);
    assert.equal(validateUsername(long).valid, false);
    assert.equal(validateUsername(long).reason, "too_long");
  });

  test("rechaza caracteres no alfanuméricos", () => {
    assert.equal(validateUsername("user name").reason, "invalid_chars");
    assert.equal(validateUsername("user-name").reason, "invalid_chars");
    assert.equal(validateUsername("simbólos!").reason, "invalid_chars");
  });

  test("rechaza reservadas case-insensitive", () => {
    for (const reserved of ["admin", "Admin", "ADMIN", "root", "null", "nakama"]) {
      assert.equal(validateUsername(reserved).valid, false, `${reserved} no debería ser válido`);
      assert.equal(validateUsername(reserved).reason, "reserved");
    }
  });
});

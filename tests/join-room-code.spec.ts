import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCode,
  normalizeRoomCode,
} from "../src/lib/room-code.ts";

// WHY: T-030 usa isValidRoomCode + un sanitizador de input inline en el cliente.
// Este test cubre la simetría: lo que el sanitizador acepta, isValidRoomCode
// valida como código legal.

const ALLOWED = new Set(ROOM_CODE_ALPHABET.split(""));

function sanitizeInput(raw: string): string {
  const upper = raw.toUpperCase();
  let out = "";
  for (const ch of upper) {
    if (ALLOWED.has(ch) && out.length < ROOM_CODE_LENGTH) out += ch;
  }
  return out;
}

describe("JoinRoom input sanitizer", () => {
  test("trunca a 6 caracteres", () => {
    assert.equal(sanitizeInput("ABCDEFGHJK"), "ABCDEF");
  });

  test("descarta caracteres fuera del alfabeto (0/O/1/I y símbolos)", () => {
    assert.equal(sanitizeInput("A0B1C-D"), "ABCD");
    assert.equal(sanitizeInput("OIABCD"), "ABCD");
    assert.equal(sanitizeInput("A B C D E F"), "ABCDEF");
  });

  test("uppercase automático", () => {
    assert.equal(sanitizeInput("abcdef"), "ABCDEF");
    assert.equal(sanitizeInput("PuNcH2"), "PUNCH2");
  });

  test("un sanitizado válido pasa isValidRoomCode", () => {
    const cases = ["ABCDEF", "punch2", "z9x8y7", "  ABCDEF  "];
    for (const raw of cases) {
      const sanitized = sanitizeInput(raw);
      if (sanitized.length === ROOM_CODE_LENGTH) {
        assert.ok(
          isValidRoomCode(sanitized),
          `sanitized(${raw}) = ${sanitized} debería ser válido`,
        );
      }
    }
  });

  test("normalizeRoomCode compatible con sanitizado", () => {
    // WHY: el server-side normaliza también; ambos deben acordar.
    const client = sanitizeInput("  abcdef  ");
    const server = normalizeRoomCode("  abcdef  ");
    assert.equal(client, "ABCDEF");
    assert.equal(server, "ABCDEF");
  });

  test("string vacío queda vacío", () => {
    assert.equal(sanitizeInput(""), "");
    assert.equal(sanitizeInput("0OI1"), "");
  });
});

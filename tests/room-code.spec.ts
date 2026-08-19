import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "../src/lib/room-code.ts";

describe("generateRoomCode", () => {
  test("genera exactamente 6 caracteres", () => {
    for (let i = 0; i < 100; i++) {
      assert.equal(generateRoomCode().length, ROOM_CODE_LENGTH);
    }
  });

  test("solo usa caracteres del alfabeto permitido", () => {
    const allowed = new Set(ROOM_CODE_ALPHABET.split(""));
    for (let i = 0; i < 100; i++) {
      for (const ch of generateRoomCode()) {
        assert.ok(allowed.has(ch), `char fuera del alfabeto: ${ch}`);
      }
    }
  });

  test("nunca emite 0/O/1/I", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode();
      assert.ok(!/[0O1I]/.test(code), `código con ambiguo: ${code}`);
    }
  });

  test("es determinista dado el mismo rng", () => {
    const rng = () => 0.5;
    assert.equal(generateRoomCode(rng), generateRoomCode(rng));
  });

  test("respeta un rng predecible (primer char = A con rng=0)", () => {
    assert.equal(generateRoomCode(() => 0), "AAAAAA");
  });
});

describe("isValidRoomCode", () => {
  test("acepta códigos válidos de 6 chars", () => {
    assert.equal(isValidRoomCode("ABCDEF"), true);
    assert.equal(isValidRoomCode("Z9X8Y7"), true);
    assert.equal(isValidRoomCode("PUNCH2"), true);
  });

  test("rechaza longitud incorrecta", () => {
    assert.equal(isValidRoomCode("ABCDE"), false);
    assert.equal(isValidRoomCode("ABCDEFG"), false);
    assert.equal(isValidRoomCode(""), false);
  });

  test("rechaza caracteres ambiguos", () => {
    assert.equal(isValidRoomCode("ABCDE0"), false);
    assert.equal(isValidRoomCode("ABCDEO"), false);
    assert.equal(isValidRoomCode("ABCDE1"), false);
    assert.equal(isValidRoomCode("ABCDEI"), false);
  });

  test("rechaza lowercase y símbolos", () => {
    assert.equal(isValidRoomCode("abcdef"), false);
    assert.equal(isValidRoomCode("ABC-DE"), false);
    assert.equal(isValidRoomCode("ABC DE"), false);
  });

  test("rechaza no-string", () => {
    // @ts-expect-error probamos el guard de runtime
    assert.equal(isValidRoomCode(123456), false);
    // @ts-expect-error probamos el guard de runtime
    assert.equal(isValidRoomCode(null), false);
  });
});

describe("normalizeRoomCode", () => {
  test("trimea y pasa a mayúsculas", () => {
    assert.equal(normalizeRoomCode("  abcdef  "), "ABCDEF");
    assert.equal(normalizeRoomCode("punch2"), "PUNCH2");
  });

  test("devuelve null para input inválido", () => {
    assert.equal(normalizeRoomCode("abc"), null);
    assert.equal(normalizeRoomCode("ABCDE0"), null);
    assert.equal(normalizeRoomCode(""), null);
    assert.equal(normalizeRoomCode("   "), null);
  });

  test("devuelve null para no-string", () => {
    // @ts-expect-error probamos el guard de runtime
    assert.equal(normalizeRoomCode(undefined), null);
  });
});

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { translateActionDown } from "../client/src/lib/input";
import { ClientOpcode } from "../src/protocol/opcodes";

describe("translateActionDown", () => {
  test("mapea punch_left → PUNCH_LEFT sin side", () => {
    assert.deepEqual(translateActionDown("punch_left", "left"), {
      opcode: ClientOpcode.PUNCH_LEFT,
    });
  });

  test("mapea punch_right → PUNCH_RIGHT sin side", () => {
    assert.deepEqual(translateActionDown("punch_right", "left"), {
      opcode: ClientOpcode.PUNCH_RIGHT,
    });
  });

  test("mapea block → BLOCK_START con el side configurado", () => {
    assert.deepEqual(translateActionDown("block", "left"), {
      opcode: ClientOpcode.BLOCK_START,
      side: "left",
    });
    assert.deepEqual(translateActionDown("block", "right"), {
      opcode: ClientOpcode.BLOCK_START,
      side: "right",
    });
  });

  test("mapea special → SPECIAL sin argumentos", () => {
    assert.deepEqual(translateActionDown("special", "left"), {
      opcode: ClientOpcode.SPECIAL,
    });
  });
});

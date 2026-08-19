import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseRegisterPayload } from "../src/rpcs/register_profile";

describe("parseRegisterPayload", () => {
  test("acepta payload válido con username string", () => {
    assert.deepEqual(parseRegisterPayload('{"username":"hector"}'), {
      username: "hector",
    });
  });

  test("trimea whitespace", () => {
    assert.deepEqual(parseRegisterPayload('{"username":"  hector  "}'), {
      username: "hector",
    });
  });

  test("rechaza payload vacío o undefined", () => {
    assert.throws(() => parseRegisterPayload(""), /PAYLOAD_REQUIRED/);
    assert.throws(() => parseRegisterPayload(undefined), /PAYLOAD_REQUIRED/);
  });

  test("rechaza JSON inválido", () => {
    assert.throws(() => parseRegisterPayload("not json"), /PAYLOAD_INVALID_JSON/);
    assert.throws(() => parseRegisterPayload("{unquoted}"), /PAYLOAD_INVALID_JSON/);
  });

  test("rechaza payload que no es objeto", () => {
    assert.throws(() => parseRegisterPayload('"hector"'), /PAYLOAD_INVALID/);
    assert.throws(() => parseRegisterPayload("null"), /PAYLOAD_INVALID/);
    assert.throws(() => parseRegisterPayload("[]"), /USERNAME_REQUIRED/);
  });

  test("rechaza username missing, no-string, o vacío", () => {
    assert.throws(() => parseRegisterPayload("{}"), /USERNAME_REQUIRED/);
    assert.throws(
      () => parseRegisterPayload('{"username":123}'),
      /USERNAME_REQUIRED/,
    );
    assert.throws(
      () => parseRegisterPayload('{"username":""}'),
      /USERNAME_REQUIRED/,
    );
    assert.throws(
      () => parseRegisterPayload('{"username":"   "}'),
      /USERNAME_REQUIRED/,
    );
  });
});

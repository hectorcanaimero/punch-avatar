import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseGenerateAvatarPayload } from "../src/rpcs/generate_avatar";

describe("parseGenerateAvatarPayload", () => {
  test("acepta payload válido con style conocido", () => {
    const result = parseGenerateAvatarPayload(
      '{"photoUrl":"https://cdn.example/x.jpg","style":"pixar_3d"}',
    );
    assert.deepEqual(result, {
      photoUrl: "https://cdn.example/x.jpg",
      style: "pixar_3d",
    });
  });

  test("acepta cada uno de los 5 estilos definidos", () => {
    for (const style of [
      "pixar_3d",
      "anime_shonen",
      "comic_retro",
      "chibi",
      "pixel_16bit",
    ]) {
      const result = parseGenerateAvatarPayload(
        `{"photoUrl":"https://cdn/x.jpg","style":"${style}"}`,
      );
      assert.equal(result.style, style);
    }
  });

  test("trimea whitespace en ambos campos", () => {
    const result = parseGenerateAvatarPayload(
      '{"photoUrl":"  https://x  ","style":"  chibi  "}',
    );
    assert.equal(result.photoUrl, "https://x");
    assert.equal(result.style, "chibi");
  });

  test("rechaza payload vacío o undefined", () => {
    assert.throws(() => parseGenerateAvatarPayload(""), /PAYLOAD_REQUIRED/);
    assert.throws(
      () => parseGenerateAvatarPayload(undefined),
      /PAYLOAD_REQUIRED/,
    );
  });

  test("rechaza JSON inválido", () => {
    assert.throws(
      () => parseGenerateAvatarPayload("not json"),
      /PAYLOAD_INVALID_JSON/,
    );
  });

  test("rechaza payload que no sea objeto", () => {
    assert.throws(() => parseGenerateAvatarPayload("[]"), /PAYLOAD_INVALID/);
    assert.throws(() => parseGenerateAvatarPayload("null"), /PAYLOAD_INVALID/);
    assert.throws(
      () => parseGenerateAvatarPayload('"hello"'),
      /PAYLOAD_INVALID/,
    );
  });

  test("rechaza photoUrl missing, no-string, o vacío", () => {
    assert.throws(
      () => parseGenerateAvatarPayload('{"style":"pixar_3d"}'),
      /PHOTO_URL_REQUIRED/,
    );
    assert.throws(
      () => parseGenerateAvatarPayload('{"photoUrl":123,"style":"pixar_3d"}'),
      /PHOTO_URL_REQUIRED/,
    );
    assert.throws(
      () => parseGenerateAvatarPayload('{"photoUrl":"   ","style":"pixar_3d"}'),
      /PHOTO_URL_REQUIRED/,
    );
  });

  test("rechaza style missing, no-string, o vacío", () => {
    assert.throws(
      () => parseGenerateAvatarPayload('{"photoUrl":"https://x"}'),
      /STYLE_REQUIRED/,
    );
    assert.throws(
      () => parseGenerateAvatarPayload('{"photoUrl":"https://x","style":123}'),
      /STYLE_REQUIRED/,
    );
    assert.throws(
      () =>
        parseGenerateAvatarPayload('{"photoUrl":"https://x","style":"   "}'),
      /STYLE_REQUIRED/,
    );
  });

  test("rechaza style desconocido con el nombre en el error", () => {
    assert.throws(
      () =>
        parseGenerateAvatarPayload(
          '{"photoUrl":"https://x","style":"vaporwave"}',
        ),
      /STYLE_INVALID:vaporwave/,
    );
  });
});

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  STYLE_CARDS,
  GENERATION_STAGES,
  getGenerationStage,
  formatAvatarError,
  validateAvatarGenerationParams,
} from "../client/src/screens/AvatarStudio";
import { AVATAR_STYLES, type AvatarStyle } from "../src/data/avatar-prompts";

describe("STYLE_CARDS", () => {
  test("cubre exactamente los 5 estilos definidos en AVATAR_STYLES", () => {
    const keys = Object.keys(STYLE_CARDS);
    assert.equal(keys.length, 5);
    for (const style of AVATAR_STYLES) {
      assert.ok(STYLE_CARDS[style], `Falta estilo ${style} en STYLE_CARDS`);
      assert.equal(STYLE_CARDS[style].id, style);
    }
  });

  test("cada tarjeta de estilo contiene metadata visual completa y válida", () => {
    for (const style of AVATAR_STYLES) {
      const card = STYLE_CARDS[style];
      assert.ok(card.name.length > 0, `name vacío en ${style}`);
      assert.ok(card.tagline.length > 0, `tagline vacío en ${style}`);
      assert.ok(card.description.length > 0, `description vacía en ${style}`);
      assert.ok(card.icon.length > 0, `icon vacío en ${style}`);
      assert.ok(card.accentColor.startsWith("#"), `accentColor inválido en ${style}`);
      assert.ok(card.badge.length > 0, `badge vacío en ${style}`);
      assert.ok(card.previewBg.includes("linear-gradient"), `previewBg inválido en ${style}`);
    }
  });
});

describe("getGenerationStage", () => {
  test("resuelve los pasos intermedios de acuerdo al porcentaje", () => {
    const stage0 = getGenerationStage(0);
    assert.equal(stage0.percent, 15);
    assert.ok(stage0.label.includes("Preparando"));

    const stage30 = getGenerationStage(30);
    assert.equal(stage30.percent, 35);
    assert.ok(stage30.label.includes("Subiendo"));

    const stage50 = getGenerationStage(50);
    assert.equal(stage50.percent, 60);
    assert.ok(stage50.label.includes("InstantID"));

    const stage80 = getGenerationStage(80);
    assert.equal(stage80.percent, 85);
    assert.ok(stage80.label.includes("estilo"));

    const stage100 = getGenerationStage(100);
    assert.equal(stage100.percent, 100);
    assert.ok(stage100.label.includes("listo"));
  });

  test("clampea valores negativos o superiores a 100", () => {
    const stageNegative = getGenerationStage(-20);
    assert.equal(stageNegative.percent, 15);

    const stageOverflow = getGenerationStage(250);
    assert.equal(stageOverflow.percent, 100);
  });

  test("todas las etapas en GENERATION_STAGES tienen label y tip no vacíos", () => {
    for (const stage of GENERATION_STAGES) {
      assert.ok(stage.percent > 0 && stage.percent <= 100);
      assert.ok(stage.label.length > 0);
      assert.ok(stage.tip.length > 0);
    }
  });
});

describe("formatAvatarError", () => {
  test("formatea mensajes comprensibles en español para cada tipo de error", () => {
    assert.ok(
      formatAvatarError(new Error("CONSENT_REQUIRED")).includes("consentimiento")
    );
    assert.ok(
      formatAvatarError("NO_FACE_DETECTED").includes("No se detectó un rostro")
    );
    assert.ok(
      formatAvatarError("FACE_TOO_SMALL").includes("No se detectó un rostro")
    );
    assert.ok(
      formatAvatarError("PHOTO_REQUIRED").includes("Falta seleccionar una foto")
    );
    assert.ok(
      formatAvatarError("PHOTO_URL_REQUIRED").includes("Falta seleccionar una foto")
    );
    assert.ok(
      formatAvatarError("STYLE_REQUIRED").includes("Elegí un estilo de avatar")
    );
    assert.ok(
      formatAvatarError("STYLE_INVALID:unknown").includes("Elegí un estilo de avatar")
    );
    assert.ok(
      formatAvatarError("AUTH_REQUIRED").includes("Sesión expirada")
    );
    assert.ok(
      formatAvatarError("UPLOAD_NOT_CONFIGURED").includes("Error al subir la imagen")
    );
    assert.ok(
      formatAvatarError("CLOUDINARY_UPLOAD_FAILED: 500").includes("Error al subir la imagen")
    );
    assert.ok(
      formatAvatarError("REPLICATE_ERROR").includes("El motor de IA demoró")
    );
    assert.ok(
      formatAvatarError("TIMED_OUT").includes("El motor de IA demoró")
    );
    assert.ok(
      formatAvatarError("UNKNOWN_CRASH").includes("Ocurrió un error")
    );
  });
});

describe("validateAvatarGenerationParams", () => {
  test("valida exitosamente cuando foto, estilo y consentimiento están presentes", () => {
    const resString = validateAvatarGenerationParams(
      "https://res.cloudinary.com/demo/photo.jpg",
      "pixar_3d",
      true
    );
    assert.deepEqual(resString, { valid: true });

    // Dummy blob
    const dummyBlob = { size: 1024, type: "image/jpeg" } as unknown as Blob;
    const resBlob = validateAvatarGenerationParams(dummyBlob, "chibi", true);
    assert.deepEqual(resBlob, { valid: true });
  });

  test("falla si falta la foto", () => {
    const res = validateAvatarGenerationParams(null, "pixar_3d", true);
    assert.equal(res.valid, false);
    assert.equal(res.error, "PHOTO_REQUIRED");
  });

  test("falla si falta el estilo o es inválido", () => {
    const resNull = validateAvatarGenerationParams("https://x.jpg", null, true);
    assert.equal(resNull.valid, false);
    assert.equal(resNull.error, "STYLE_REQUIRED");

    const resInvalid = validateAvatarGenerationParams(
      "https://x.jpg",
      "vaporwave" as unknown as AvatarStyle,
      true
    );
    assert.equal(resInvalid.valid, false);
    assert.equal(resInvalid.error, "STYLE_REQUIRED");
  });

  test("falla si el consentimiento no está marcado", () => {
    const res = validateAvatarGenerationParams(
      "https://x.jpg",
      "anime_shonen",
      false
    );
    assert.equal(res.valid, false);
    assert.equal(res.error, "CONSENT_REQUIRED");
  });
});

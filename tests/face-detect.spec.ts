import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  computeSquareCropBox,
  validateFaceBox,
  validatePhotoFile,
  formatDetectionError,
  MAX_PHOTO_BYTES,
  MIN_FACE_DIMENSION,
  DEFAULT_PADDING_FACTOR,
  type FaceBox,
  type ImageDimensions,
} from "../client/src/lib/face-detect";

describe("computeSquareCropBox", () => {
  test("centra recorte 1:1 en rostro sobre imagen landscape", () => {
    const image: ImageDimensions = { width: 1920, height: 1080 };
    const face: FaceBox = { x: 900, y: 400, width: 120, height: 150 };

    const crop = computeSquareCropBox(image, face, 1.8);

    assert.ok(crop.size > 0);
    assert.equal(typeof crop.x, "number");
    assert.equal(typeof crop.y, "number");
    assert.equal(typeof crop.size, "number");

    // Recorte 1:1 estricto y contenido dentro de la imagen
    assert.ok(crop.x >= 0, `crop.x=${crop.x} no debe ser negativo`);
    assert.ok(crop.y >= 0, `crop.y=${crop.y} no debe ser negativo`);
    assert.ok(
      crop.x + crop.size <= image.width,
      `crop.x + size (${crop.x + crop.size}) supera width ${image.width}`
    );
    assert.ok(
      crop.y + crop.size <= image.height,
      `crop.y + size (${crop.y + crop.size}) supera height ${image.height}`
    );

    // Contiene al rostro
    assert.ok(crop.x <= face.x);
    assert.ok(crop.y <= face.y);
    assert.ok(crop.x + crop.size >= face.x + face.width);
    assert.ok(crop.y + crop.size >= face.y + face.height);
  });

  test("clampea coordenadas al borde superior izquierdo si el rostro está en (0, 0)", () => {
    const image: ImageDimensions = { width: 1000, height: 1000 };
    const face: FaceBox = { x: 0, y: 0, width: 100, height: 100 };

    const crop = computeSquareCropBox(image, face, 2.0);

    assert.equal(crop.x, 0);
    assert.equal(crop.y, 0);
    assert.equal(crop.size, 200);
    assert.ok(crop.x + crop.size <= image.width);
    assert.ok(crop.y + crop.size <= image.height);
  });

  test("clampea coordenadas al borde inferior derecho sin desbordar", () => {
    const image: ImageDimensions = { width: 800, height: 600 };
    const face: FaceBox = { x: 740, y: 540, width: 50, height: 50 };

    const crop = computeSquareCropBox(image, face, 2.0);

    assert.ok(crop.x >= 0);
    assert.ok(crop.y >= 0);
    assert.equal(crop.x + crop.size, image.width);
    assert.equal(crop.y + crop.size, image.height);
  });

  test("limita el tamaño del cuadrado a la dimensión menor en imágenes portrait", () => {
    const image: ImageDimensions = { width: 600, height: 1200 };
    const face: FaceBox = { x: 100, y: 200, width: 400, height: 400 };

    const crop = computeSquareCropBox(image, face, 2.5);

    // No puede superar el ancho de 600
    assert.equal(crop.size, 600);
    assert.equal(crop.x, 0);
    assert.ok(crop.y >= 0);
    assert.ok(crop.y + crop.size <= image.height);
  });

  test("produce coordenadas enteras sin decimales", () => {
    const image: ImageDimensions = { width: 1023, height: 767 };
    const face: FaceBox = { x: 333, y: 221, width: 111, height: 133 };

    const crop = computeSquareCropBox(image, face, DEFAULT_PADDING_FACTOR);

    assert.equal(Number.isInteger(crop.x), true);
    assert.equal(Number.isInteger(crop.y), true);
    assert.equal(Number.isInteger(crop.size), true);
  });
});

describe("validateFaceBox", () => {
  test("acepta una bounding box válida", () => {
    const face: FaceBox = { x: 100, y: 100, width: 150, height: 150 };
    const result = validateFaceBox(face, 800, 600);

    assert.equal(result.valid, true);
    assert.equal(result.reason, undefined);
  });

  test("rechaza null o undefined", () => {
    assert.equal(validateFaceBox(null, 800, 600).valid, false);
    assert.equal(validateFaceBox(null, 800, 600).reason, "NO_FACE_DETECTED");

    assert.equal(validateFaceBox(undefined, 800, 600).valid, false);
    assert.equal(validateFaceBox(undefined, 800, 600).reason, "NO_FACE_DETECTED");
  });

  test("rechaza valores no numéricos o infinitos", () => {
    assert.equal(
      validateFaceBox({ x: "10", y: 20, width: 100, height: 100 }, 800, 600).valid,
      false
    );
    assert.equal(
      validateFaceBox({ x: 10, y: NaN, width: 100, height: 100 }, 800, 600).valid,
      false
    );
    assert.equal(
      validateFaceBox({ x: 10, y: 20, width: Infinity, height: 100 }, 800, 600).valid,
      false
    );
  });

  test("rechaza rostros menores al umbral mínimo", () => {
    const tinyFace: FaceBox = { x: 50, y: 50, width: MIN_FACE_DIMENSION - 5, height: 40 };
    const result = validateFaceBox(tinyFace, 800, 600);

    assert.equal(result.valid, false);
    assert.equal(result.reason, "FACE_TOO_SMALL");
  });

  test("rechaza coordenadas fuera de la imagen", () => {
    const outOfBoundsFace: FaceBox = { x: 850, y: 100, width: 100, height: 100 };
    const result = validateFaceBox(outOfBoundsFace, 800, 600);

    assert.equal(result.valid, false);
    assert.equal(result.reason, "NO_FACE_DETECTED");
  });
});

describe("validatePhotoFile", () => {
  test("acepta JPEG, PNG y WEBP dentro de 10 MB", () => {
    assert.equal(validatePhotoFile({ size: 1024 * 1024, type: "image/jpeg" }).valid, true);
    assert.equal(validatePhotoFile({ size: 2 * 1024 * 1024, type: "image/png" }).valid, true);
    assert.equal(validatePhotoFile({ size: 500 * 1024, type: "image/webp" }).valid, true);
  });

  test("rechaza archivos mayores a 10 MB", () => {
    const heavyFile = { size: MAX_PHOTO_BYTES + 1024, type: "image/jpeg" };
    const result = validatePhotoFile(heavyFile);

    assert.equal(result.valid, false);
    assert.equal(result.error, "FILE_TOO_LARGE");
    assert.ok(result.message?.includes("10 MB"));
  });

  test("rechaza tipos MIME no soportados", () => {
    const pdfFile = { size: 1024 * 1024, type: "application/pdf" };
    const result = validatePhotoFile(pdfFile);

    assert.equal(result.valid, false);
    assert.equal(result.error, "INVALID_FILE_TYPE");
  });

  test("rechaza archivo nulo", () => {
    const result = validatePhotoFile(null);
    assert.equal(result.valid, false);
    assert.equal(result.error, "INVALID_FILE_TYPE");
  });
});

describe("formatDetectionError", () => {
  test("retorna mensajes en español claros para el usuario", () => {
    assert.ok(formatDetectionError("NO_FACE_DETECTED").includes("No se detectó ningún rostro"));
    assert.ok(formatDetectionError("FACE_TOO_SMALL").includes("pequeño"));
    assert.ok(formatDetectionError("MULTIPLE_FACES").includes("varios rostros"));
    assert.ok(formatDetectionError("FILE_TOO_LARGE").includes("10 MB"));
    assert.ok(formatDetectionError("INVALID_FILE_TYPE").includes("JPG, PNG o WEBP"));
  });
});

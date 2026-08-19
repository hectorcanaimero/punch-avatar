/**
 * face-detect.ts — Detección facial client-side con face-api.js y recorte 1:1.
 *
 * Funciones puras de cálculo geométrico y recorte para preparar la foto de perfil
 * antes de subirla al pipeline de generación de avatar (Replicate InstantID).
 */

export const DEFAULT_MODEL_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB (límite RPC Cloudinary)
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
] as const;

export const MIN_FACE_DIMENSION = 30; // Mínimo de px para ancho/alto del rostro
export const DEFAULT_PADDING_FACTOR = 1.8; // Margen para cabeza + pelo + mentón en recorte 1:1

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
}

export interface SquareCropBox {
  x: number;
  y: number;
  size: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export type DetectionErrorCode =
  | "NO_FACE_DETECTED"
  | "FACE_TOO_SMALL"
  | "MULTIPLE_FACES"
  | "MODEL_LOAD_FAILED"
  | "IMAGE_LOAD_FAILED"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE";

export interface FaceDetectionResult {
  detected: boolean;
  face?: FaceBox;
  cropBox?: SquareCropBox;
  allFaces?: FaceBox[];
  error?: DetectionErrorCode;
  message?: string;
}

export interface CropResult {
  blob: Blob;
  dataUrl: string;
  cropBox: SquareCropBox;
  width: number;
  height: number;
}

export interface DetectFaceOptions {
  modelBaseUrl?: string;
  scoreThreshold?: number;
  inputSize?: number;
  paddingFactor?: number;
  allowMultipleFaces?: boolean;
}

/**
 * Valida formato y tamaño del archivo seleccionado por el usuario.
 */
export function validatePhotoFile(file: { size: number; type: string } | null | undefined): {
  valid: boolean;
  error?: DetectionErrorCode;
  message?: string;
} {
  if (!file) {
    return {
      valid: false,
      error: "INVALID_FILE_TYPE",
      message: "No se seleccionó ningún archivo.",
    };
  }

  const normalizedType = (file.type || "").toLowerCase().trim();
  const isAllowed = ALLOWED_MIME_TYPES.some((type) => normalizedType === type || normalizedType.includes(type.replace("image/", "")));

  if (!isAllowed) {
    return {
      valid: false,
      error: "INVALID_FILE_TYPE",
      message: "Formato no soportado. Usá JPG, PNG o WEBP.",
    };
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return {
      valid: false,
      error: "FILE_TOO_LARGE",
      message: "La foto supera los 10 MB permitidos.",
    };
  }

  return { valid: true };
}

/**
 * Valida que una bounding box de rostro sea coherente y cumpla con las dimensiones mínimas.
 */
export function validateFaceBox(
  face: unknown,
  imageWidth: number,
  imageHeight: number,
  minDimension = MIN_FACE_DIMENSION
): { valid: boolean; reason?: DetectionErrorCode } {
  if (!face || typeof face !== "object") {
    return { valid: false, reason: "NO_FACE_DETECTED" };
  }

  const { x, y, width, height } = face as Record<string, unknown>;

  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return { valid: false, reason: "NO_FACE_DETECTED" };
  }

  if (width < minDimension || height < minDimension) {
    return { valid: false, reason: "FACE_TOO_SMALL" };
  }

  if (x < 0 || y < 0 || width <= 0 || height <= 0) {
    return { valid: false, reason: "NO_FACE_DETECTED" };
  }

  if (x >= imageWidth || y >= imageHeight) {
    return { valid: false, reason: "NO_FACE_DETECTED" };
  }

  return { valid: true };
}

/**
 * Calcula un recorte cuadrado 1:1 centrado en el rostro detectado.
 * Asegura que el cuadrado quede 100% contenido dentro de los límites de la imagen
 * y añade un padding proporcional para incluir pelo y mentón.
 */
export function computeSquareCropBox(
  image: ImageDimensions,
  face: FaceBox,
  paddingFactor = DEFAULT_PADDING_FACTOR
): SquareCropBox {
  const imgW = Math.max(1, Math.round(image.width));
  const imgH = Math.max(1, Math.round(image.height));

  const maxFaceDim = Math.max(face.width, face.height);
  const factor = Math.max(1.0, paddingFactor);
  const targetSquareSize = maxFaceDim * factor;

  // El cuadrado no puede superar la dimensión más chica de la imagen
  const maxPossibleSize = Math.min(imgW, imgH);
  const size = Math.round(Math.min(maxPossibleSize, Math.max(targetSquareSize, maxFaceDim)));

  // Centro del rostro con leve sesgo superior (y * 0.45) para capturar el pelo del boxeador
  const faceCenterX = face.x + face.width / 2;
  const faceCenterY = face.y + face.height * 0.45;

  let x = Math.round(faceCenterX - size / 2);
  let y = Math.round(faceCenterY - size / 2);

  // Clampeo estricto a las fronteras [0, imgW - size] y [0, imgH - size]
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + size > imgW) x = imgW - size;
  if (y + size > imgH) y = imgH - size;

  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    size: Math.min(size, maxPossibleSize),
  };
}

/**
 * Mensajes de error legibles para la UI del juego.
 */
export function formatDetectionError(code: DetectionErrorCode): string {
  switch (code) {
    case "NO_FACE_DETECTED":
      return "No se detectó ningún rostro. Por favor subí una selfie o foto de frente con buena luz.";
    case "FACE_TOO_SMALL":
      return "El rostro está muy lejos o es muy pequeño. Acercate más a la cámara.";
    case "MULTIPLE_FACES":
      return "Se detectaron varios rostros en la foto. La foto debe ser individual.";
    case "MODEL_LOAD_FAILED":
      return "No se pudo inicializar el detector facial. Revisá tu conexión a internet.";
    case "IMAGE_LOAD_FAILED":
      return "No se pudo procesar la imagen seleccionada.";
    case "FILE_TOO_LARGE":
      return "La foto supera los 10 MB permitidos.";
    case "INVALID_FILE_TYPE":
      return "Formato no soportado. Subí un archivo JPG, PNG o WEBP.";
    default:
      return "Error al analizar la imagen. Probá con otra foto.";
  }
}

// Cache singleton para la carga de modelos de face-api
let modelsPromise: Promise<boolean> | null = null;

/**
 * Carga los pesos del modelo TinyFaceDetector desde la URL configurada.
 */
export async function loadFaceDetectionModels(
  modelBaseUrl = DEFAULT_MODEL_BASE_URL
): Promise<boolean> {
  if (modelsPromise) {
    return modelsPromise;
  }

  modelsPromise = (async () => {
    try {
      const faceapi = await import("@vladmandic/face-api");
      if (!faceapi.nets.tinyFaceDetector.isLoaded) {
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelBaseUrl);
      }
      return true;
    } catch (err) {
      modelsPromise = null;
      console.warn("Error cargando modelos face-api desde:", modelBaseUrl, err);
      return false;
    }
  })();

  return modelsPromise;
}

/**
 * Detecta rostros en un elemento de imagen o canvas y retorna la bounding box y el recorte 1:1.
 */
export async function detectFaceInImage(
  imageSource: HTMLImageElement | HTMLCanvasElement,
  options: DetectFaceOptions = {}
): Promise<FaceDetectionResult> {
  const {
    modelBaseUrl = DEFAULT_MODEL_BASE_URL,
    scoreThreshold = 0.45,
    inputSize = 320,
    paddingFactor = DEFAULT_PADDING_FACTOR,
    allowMultipleFaces = false,
  } = options;

  const width =
    "naturalWidth" in imageSource ? imageSource.naturalWidth : imageSource.width;
  const height =
    "naturalHeight" in imageSource ? imageSource.naturalHeight : imageSource.height;

  if (width <= 0 || height <= 0) {
    return {
      detected: false,
      error: "IMAGE_LOAD_FAILED",
      message: formatDetectionError("IMAGE_LOAD_FAILED"),
    };
  }

  try {
    const loaded = await loadFaceDetectionModels(modelBaseUrl);
    if (!loaded) {
      return {
        detected: false,
        error: "MODEL_LOAD_FAILED",
        message: formatDetectionError("MODEL_LOAD_FAILED"),
      };
    }

    const faceapi = await import("@vladmandic/face-api");
    const detectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize,
      scoreThreshold,
    });

    const detections = await faceapi.detectAllFaces(
      imageSource,
      detectorOptions
    );

    if (!detections || detections.length === 0) {
      return {
        detected: false,
        error: "NO_FACE_DETECTED",
        message: formatDetectionError("NO_FACE_DETECTED"),
      };
    }

    const allFaces: FaceBox[] = detections.map((d) => ({
      x: Math.round(d.box.x),
      y: Math.round(d.box.y),
      width: Math.round(d.box.width),
      height: Math.round(d.box.height),
      confidence: Math.round((d.score || 0) * 100) / 100,
    }));

    if (allFaces.length > 1 && !allowMultipleFaces) {
      return {
        detected: false,
        allFaces,
        error: "MULTIPLE_FACES",
        message: formatDetectionError("MULTIPLE_FACES"),
      };
    }

    // Elegir el rostro más prominente (mayor área)
    const primaryFace = allFaces.reduce((best, curr) =>
      curr.width * curr.height > best.width * best.height ? curr : best
    );

    const validation = validateFaceBox(primaryFace, width, height);
    if (!validation.valid && validation.reason) {
      return {
        detected: false,
        face: primaryFace,
        allFaces,
        error: validation.reason,
        message: formatDetectionError(validation.reason),
      };
    }

    const cropBox = computeSquareCropBox(
      { width, height },
      primaryFace,
      paddingFactor
    );

    return {
      detected: true,
      face: primaryFace,
      cropBox,
      allFaces,
    };
  } catch (error) {
    console.error("detectFaceInImage fallo:", error);
    return {
      detected: false,
      error: "NO_FACE_DETECTED",
      message: formatDetectionError("NO_FACE_DETECTED"),
    };
  }
}

/**
 * Carga un archivo File o Blob a un objeto HTMLImageElement en memoria.
 */
export function fileToImageElement(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("IMAGE_LOAD_FAILED"));
    };

    img.src = objectUrl;
  });
}

/**
 * Recorta la región cuadrada 1:1 indicada por cropBox a un canvas y genera Blob y dataURL.
 */
export async function cropImageToSquare(
  imageSource: HTMLImageElement | HTMLCanvasElement,
  cropBox: SquareCropBox,
  targetSize = 512,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
  quality = 0.92
): Promise<CropResult> {
  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("CANVAS_CONTEXT_FAILED");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    imageSource,
    cropBox.x,
    cropBox.y,
    cropBox.size,
    cropBox.size,
    0,
    0,
    targetSize,
    targetSize
  );

  const dataUrl = canvas.toDataURL(mimeType, quality);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("BLOB_CREATION_FAILED"));
      },
      mimeType,
      quality
    );
  });

  return {
    blob,
    dataUrl,
    cropBox,
    width: targetSize,
    height: targetSize,
  };
}

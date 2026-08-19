/**
 * Genera params firmados para upload directo a Cloudinary.
 * Cliente sube multipart/form-data a la URL retornada.
 *
 * Cloudinary signed upload: signature = SHA256(string_to_sign + api_secret)
 * con string_to_sign = "key=value&key=value&...&timestamp=..." (orden alfabético).
 * Se pasa signature_algorithm=sha256 para indicar el algoritmo.
 */

const CLOUDINARY_UPLOAD_URL = (cloudName: string): string =>
  `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

const FOLDER = "punch/photos";
const ALLOWED_FORMATS = "jpg,jpeg,png,webp";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_IMAGE_DIMENSION = 4096;

function parseUploadPayload(raw: string | undefined): Record<string, never> {
  if (!raw || raw === "") return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("PAYLOAD_INVALID");
    }
    return {};
  } catch {
    throw new Error("PAYLOAD_INVALID_JSON");
  }
}

export const uploadPhotoUrlRpc: nkruntime.RpcFunction = (
  ctx,
  logger,
  nk,
  payload
): string => {
  parseUploadPayload(payload);

  const cloudName = ctx.env["CLOUDINARY_CLOUD_NAME"];
  const apiKey = ctx.env["CLOUDINARY_API_KEY"];
  const apiSecret = ctx.env["CLOUDINARY_API_SECRET"];

  if (!cloudName || !apiKey || !apiSecret) {
    logger.error(
      "missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in runtime env"
    );
    throw new Error("UPLOAD_NOT_CONFIGURED");
  }

  if (!ctx.userId) {
    throw new Error("AUTH_REQUIRED");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  // WHY: public_id estable por usuario+timestamp para evitar colisiones y
  // facilitar cleanup de fotos viejas cuando cambian de avatar.
  const publicId = `punch/${ctx.userId}_${timestamp}`;

  const paramsToSign: Record<string, string> = {
    folder: FOLDER,
    allowed_formats: ALLOWED_FORMATS,
    max_file_size: String(MAX_FILE_SIZE),
    max_image_dimension: String(MAX_IMAGE_DIMENSION),
    public_id: publicId,
    timestamp: String(timestamp),
    signature_algorithm: "sha256",
  };

  // string_to_sign: "key=value&key=value" ordenado alfabético por key,
  // sin el api_secret (se concatena al final antes de hashear).
  const stringToSign =
    Object.keys(paramsToSign)
      .sort()
      .map((key) => `${key}=${paramsToSign[key]}`)
      .join("&") + apiSecret;

  const signature = nk.sha256Hash(stringToSign);

  logger.info(`upload_photo_url: userId=${ctx.userId} publicId=${publicId}`);

  return JSON.stringify({
    url: CLOUDINARY_UPLOAD_URL(cloudName),
    params: {
      ...paramsToSign,
      api_key: apiKey,
      signature,
    },
  });
};

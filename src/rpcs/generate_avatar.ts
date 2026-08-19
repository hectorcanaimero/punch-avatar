import {
  AVATAR_STYLES,
  getAvatarPrompt,
  type AvatarStyle,
} from "../data/avatar-prompts";
import { generateReplicateImage, ReplicateError } from "../lib/replicate";

const PROFILES_COLLECTION = "profiles";
const PROFILE_KEY = "profile";
const AVATAR_CACHE_COLLECTION = "avatar_cache";

const INFERENCE_STEPS = 30;

type CachedAvatar = {
  avatarUrl: string;
  style: AvatarStyle;
  photoUrl: string;
  generatedAt: string;
};

export function parseGenerateAvatarPayload(raw: string | undefined): {
  photoUrl: string;
  style: AvatarStyle;
} {
  if (!raw) throw new Error("PAYLOAD_REQUIRED");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("PAYLOAD_INVALID_JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("PAYLOAD_INVALID");
  }
  const { photoUrl, style } = parsed as {
    photoUrl?: unknown;
    style?: unknown;
  };
  if (typeof photoUrl !== "string" || photoUrl.trim() === "") {
    throw new Error("PHOTO_URL_REQUIRED");
  }
  if (typeof style !== "string" || style.trim() === "") {
    throw new Error("STYLE_REQUIRED");
  }
  const trimmedStyle = style.trim();
  if (!AVATAR_STYLES.includes(trimmedStyle as AvatarStyle)) {
    throw new Error(`STYLE_INVALID:${trimmedStyle}`);
  }
  return {
    photoUrl: photoUrl.trim(),
    style: trimmedStyle as AvatarStyle,
  };
}

export const generateAvatarRpc: nkruntime.RpcFunction = (
  ctx,
  logger,
  nk,
  payload
): string => {
  if (!ctx.userId) throw new Error("AUTH_REQUIRED");
  const userId = ctx.userId;

  const { photoUrl, style } = parseGenerateAvatarPayload(payload);

  // WHY: API token y model version viven en runtime.env de nakama.yml, nunca
  // en el cliente. El RPC exige ambas explícitas antes de cualquier llamada.
  const apiToken = ctx.env["REPLICATE_API_TOKEN"];
  const modelVersion = ctx.env["REPLICATE_INSTANT_ID_VERSION"];
  if (!apiToken) throw new Error("CONFIG_MISSING:REPLICATE_API_TOKEN");
  if (!modelVersion) {
    throw new Error("CONFIG_MISSING:REPLICATE_INSTANT_ID_VERSION");
  }

  // Idempotencia por hash(photoUrl+style), user-scoped: mismo input del mismo
  // usuario nunca dispara una segunda llamada a Replicate (costo aprox USD 0.02).
  const cacheKey = nk.sha256Hash(`${photoUrl}:${style}`);
  const cached = nk.storageRead([
    {
      collection: AVATAR_CACHE_COLLECTION,
      key: cacheKey,
      userId,
    },
  ]);
  if (cached.length > 0) {
    const value = cached[0].value as CachedAvatar;
    logger.info(`avatar cache hit: userId=${userId} style=${style}`);
    return JSON.stringify({
      avatarUrl: value.avatarUrl,
      style,
      cached: true,
    });
  }

  const template = getAvatarPrompt(style);

  let avatarUrl: string;
  try {
    avatarUrl = generateReplicateImage(nk, apiToken, {
      version: modelVersion,
      input: {
        image: photoUrl,
        prompt: template.positive,
        negative_prompt: template.negative,
        ip_adapter_scale: template.identityWeight,
        controlnet_conditioning_scale: template.styleWeight,
        num_inference_steps: INFERENCE_STEPS,
      },
    });
  } catch (err) {
    if (err instanceof ReplicateError) {
      throw new Error(`REPLICATE_${err.code}:${err.message}`);
    }
    throw err;
  }

  const profiles = nk.storageRead([
    { collection: PROFILES_COLLECTION, key: PROFILE_KEY, userId },
  ]);
  if (profiles.length === 0) throw new Error("PROFILE_NOT_FOUND");
  const currentProfile = profiles[0].value as Record<string, unknown>;
  const updatedProfile = {
    ...currentProfile,
    avatarUrl,
    avatarStyle: style,
  };

  // WHY: dos writes en un solo storageWrite → atomicidad. Si Replicate ya cobró,
  // el perfil y el cache quedan alineados o ninguno.
  const cacheEntry: CachedAvatar = {
    avatarUrl,
    style,
    photoUrl,
    generatedAt: new Date().toISOString(),
  };
  nk.storageWrite([
    {
      collection: AVATAR_CACHE_COLLECTION,
      key: cacheKey,
      userId,
      value: cacheEntry,
      permissionRead: 1,
      permissionWrite: 0,
    },
    {
      collection: PROFILES_COLLECTION,
      key: PROFILE_KEY,
      userId,
      value: updatedProfile,
      permissionRead: 2,
      permissionWrite: 0,
    },
  ]);

  logger.info(`avatar generated: userId=${userId} style=${style}`);
  return JSON.stringify({ avatarUrl, style, cached: false });
};

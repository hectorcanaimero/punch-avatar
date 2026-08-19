import type { Profile } from "./register_profile";

const PROFILES_COLLECTION = "profiles";
const PROFILE_KEY = "profile";

const MIN_LENGTH = 2;
const MAX_LENGTH = 24;

export interface UpdateDisplayNameRequest {
  displayName: string;
}

export function sanitizeDisplayName(raw: string): string {
  return raw
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseUpdateDisplayNamePayload(
  raw: string | undefined
): UpdateDisplayNameRequest {
  if (!raw) throw new Error("PAYLOAD_REQUIRED");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("PAYLOAD_INVALID_JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("PAYLOAD_INVALID");
  }
  const displayName = (parsed as { displayName?: unknown }).displayName;
  if (typeof displayName !== "string") {
    throw new Error("DISPLAY_NAME_REQUIRED");
  }
  return { displayName };
}

export function validateDisplayName(
  input: string
): { valid: boolean; reason: string; value: string } {
  const sanitized = sanitizeDisplayName(input);
  if (sanitized.length < MIN_LENGTH) {
    return { valid: false, reason: "too_short", value: sanitized };
  }
  if (sanitized.length > MAX_LENGTH) {
    return { valid: false, reason: "too_long", value: sanitized };
  }
  return { valid: true, reason: "ok", value: sanitized };
}

export const updateDisplayNameRpc: nkruntime.RpcFunction = (
  ctx,
  logger,
  nk,
  payload
): string => {
  if (!ctx.userId) throw new Error("AUTH_REQUIRED");

  const { displayName } = parseUpdateDisplayNamePayload(payload);
  const validation = validateDisplayName(displayName);
  if (!validation.valid) {
    throw new Error(`DISPLAY_NAME_INVALID:${validation.reason}`);
  }

  const objs = nk.storageRead([
    {
      collection: PROFILES_COLLECTION,
      key: PROFILE_KEY,
      userId: ctx.userId,
    },
  ]);
  if (objs.length === 0) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  const profile = objs[0].value as Profile;
  profile.displayName = validation.value;

  nk.storageWrite([
    {
      collection: PROFILES_COLLECTION,
      key: PROFILE_KEY,
      userId: ctx.userId,
      value: profile,
      permissionRead: 2,
      permissionWrite: 0,
    },
  ]);

  logger.info(
    `update_display_name: userId=${ctx.userId} displayName=${validation.value}`
  );

  return JSON.stringify({ userId: ctx.userId, profile });
};

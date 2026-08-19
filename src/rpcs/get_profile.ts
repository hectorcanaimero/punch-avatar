import type { Profile } from "./register_profile";

const PROFILES_COLLECTION = "profiles";
const PROFILE_KEY = "profile";

interface GetProfileRequest {
  userId?: string;
}

interface GetProfileResponse {
  userId: string;
  profile: Profile;
}

export function parseGetProfilePayload(
  raw: string | undefined
): GetProfileRequest {
  if (!raw || raw.trim() === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("PAYLOAD_INVALID_JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("PAYLOAD_INVALID");
  }
  const userId = (parsed as { userId?: unknown }).userId;
  if (userId === undefined) return {};
  if (typeof userId !== "string" || userId.trim() === "") {
    throw new Error("USER_ID_INVALID");
  }
  return { userId: userId.trim() };
}

export const getProfileRpc: nkruntime.RpcFunction = (
  ctx,
  _logger,
  nk,
  payload
): string => {
  const { userId: requestedId } = parseGetProfilePayload(payload);
  // WHY: si el caller pide sin userId, devolvemos su propio perfil; con userId,
  // permitimos lookup público (permissionRead=2 en storage habilita esto).
  const targetUserId = requestedId ?? ctx.userId;
  if (!targetUserId) throw new Error("UNAUTHENTICATED");

  const objs = nk.storageRead([
    {
      collection: PROFILES_COLLECTION,
      key: PROFILE_KEY,
      userId: targetUserId,
    },
  ]);
  if (objs.length === 0) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  const response: GetProfileResponse = {
    userId: targetUserId,
    profile: objs[0].value as Profile,
  };
  return JSON.stringify(response);
};

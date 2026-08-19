import { expireRoomsMatchHandler, startExpireRoomsJob } from "./jobs/expire-rooms";
import { registerLeaderboards } from "./leaderboards/setup";
import { startBotFallbackMatchRpc } from "./matchmaker/bot-fallback";
import { rankedMatchmakerMatched } from "./matchmaker/config";
import { combatMatchHandler } from "./matches/combat";
import { createFriendlyRoomRpc } from "./rpcs/create_friendly_room";
import { generateAvatarRpc } from "./rpcs/generate_avatar";
import { joinFriendlyRoomRpc } from "./rpcs/join_friendly_room";
import { getProfileRpc } from "./rpcs/get_profile";
import { pingRpc } from "./rpcs/ping";
import { registerProfileRpc } from "./rpcs/register_profile";
import { startCareerMatchRpc } from "./rpcs/start_career_match";
import { updateDisplayNameRpc } from "./rpcs/update_display_name";
import { uploadPhotoUrlRpc } from "./rpcs/upload_photo_url";

function InitModule(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
): void {
  initializer.registerRpc("ping", pingRpc);
  initializer.registerRpc("register_profile", registerProfileRpc);
  initializer.registerRpc("get_profile", getProfileRpc);
  initializer.registerRpc("update_display_name", updateDisplayNameRpc);
  initializer.registerRpc("upload_photo_url", uploadPhotoUrlRpc);
  initializer.registerRpc("generate_avatar", generateAvatarRpc);
  initializer.registerRpc("create_friendly_room", createFriendlyRoomRpc);
  initializer.registerRpc("join_friendly_room", joinFriendlyRoomRpc);
  initializer.registerRpc("start_bot_fallback_match", startBotFallbackMatchRpc);
  initializer.registerRpc("start_career_match", startCareerMatchRpc);
  initializer.registerMatch("combat", combatMatchHandler);
  initializer.registerMatch("expire_rooms", expireRoomsMatchHandler);
  initializer.registerMatchmakerMatched(rankedMatchmakerMatched);

  registerLeaderboards(nk, logger);

  startExpireRoomsJob(nk, logger);

  logger.info("punch runtime loaded");
}

// WHY: Nakama discovers InitModule as a global; the bundle must preserve that binding.
(globalThis as unknown as { InitModule: typeof InitModule }).InitModule =
  InitModule;

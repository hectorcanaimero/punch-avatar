import { registerLeaderboards } from "./leaderboards/setup";
import { combatMatchHandler } from "./matches/combat";
import { generateAvatarRpc } from "./rpcs/generate_avatar";
import { getProfileRpc } from "./rpcs/get_profile";
import { pingRpc } from "./rpcs/ping";
import { registerProfileRpc } from "./rpcs/register_profile";
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
  initializer.registerMatch("combat", combatMatchHandler);

  registerLeaderboards(nk, logger);

  logger.info("punch runtime loaded");
}

// WHY: Nakama discovers InitModule as a global; the bundle must preserve that binding.
(globalThis as unknown as { InitModule: typeof InitModule }).InitModule =
  InitModule;

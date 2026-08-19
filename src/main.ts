import { combatMatchHandler } from "./matches/combat";
import { getProfileRpc } from "./rpcs/get_profile";
import { pingRpc } from "./rpcs/ping";
import { registerProfileRpc } from "./rpcs/register_profile";

function InitModule(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
): void {
  initializer.registerRpc("ping", pingRpc);
  initializer.registerRpc("register_profile", registerProfileRpc);
  initializer.registerRpc("upload_photo_url", uploadPhotoUrlRpc);
  initializer.registerMatch("combat", combatMatchHandler);

  logger.info("punch runtime loaded");
}

// WHY: Nakama discovers InitModule as a global; the bundle must preserve that binding.
(globalThis as unknown as { InitModule: typeof InitModule }).InitModule =
  InitModule;

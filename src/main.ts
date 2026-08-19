import { combatMatchHandler } from "./matches/combat";
import { pingRpc } from "./rpcs/ping";

function InitModule(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
): void {
  initializer.registerRpc("ping", pingRpc);
  initializer.registerMatch("combat", combatMatchHandler);

  logger.info("punch runtime loaded");
}

// WHY: Nakama discovers InitModule as a global; the bundle must preserve that binding.
(globalThis as unknown as { InitModule: typeof InitModule }).InitModule =
  InitModule;

import { ClientOpcode } from "../../../src/protocol/opcodes";
import type { ClientMessage, Side } from "../../../shared/types";

export type InputListener = (msg: ClientMessage) => void;

const KEY_MAP: Record<string, "punch_left" | "punch_right" | "block" | "special"> = {
  KeyA: "punch_left",
  KeyD: "punch_right",
  KeyS: "block",
  Space: "special",
};

const DEFAULT_BLOCK_SIDE: Side = "left";

export interface InputHandlerOptions {
  target?: EventTarget;
  blockSide?: Side;
}

// WHY: retornamos la función de detach directamente para que el caller no
// tenga que trackear referencias al objeto handler — pattern React-friendly.
export function attachInputHandler(
  listener: InputListener,
  options: InputHandlerOptions = {},
): () => void {
  const target = options.target ?? window;
  const blockSide = options.blockSide ?? DEFAULT_BLOCK_SIDE;

  // WHY: los navegadores emiten keydown repetido mientras la tecla está
  // pulsada. Para PUNCH y SPECIAL queremos un solo evento por presión.
  const pressed = new Set<string>();

  const handleKeyDown = (event: Event): void => {
    const keyboard = event as KeyboardEvent;
    const action = KEY_MAP[keyboard.code];
    if (!action) return;
    if (keyboard.repeat) return;
    if (pressed.has(keyboard.code)) return;
    pressed.add(keyboard.code);

    const message = translateActionDown(action, blockSide);
    if (message) {
      keyboard.preventDefault();
      listener(message);
    }
  };

  const handleKeyUp = (event: Event): void => {
    const keyboard = event as KeyboardEvent;
    if (!KEY_MAP[keyboard.code]) return;
    pressed.delete(keyboard.code);

    if (KEY_MAP[keyboard.code] === "block") {
      keyboard.preventDefault();
      listener({ opcode: ClientOpcode.BLOCK_END });
    }
  };

  // WHY: window blur (alt-tab, minimize) puede dejar teclas "trabadas".
  // Limpiamos el estado y avisamos al servidor si había un bloqueo activo.
  const handleBlur = (): void => {
    if (pressed.has("KeyS")) {
      listener({ opcode: ClientOpcode.BLOCK_END });
    }
    pressed.clear();
  };

  target.addEventListener("keydown", handleKeyDown);
  target.addEventListener("keyup", handleKeyUp);
  target.addEventListener("blur", handleBlur);

  return () => {
    target.removeEventListener("keydown", handleKeyDown);
    target.removeEventListener("keyup", handleKeyUp);
    target.removeEventListener("blur", handleBlur);
    pressed.clear();
  };
}

export function translateActionDown(
  action: "punch_left" | "punch_right" | "block" | "special",
  blockSide: Side,
): ClientMessage | null {
  switch (action) {
    case "punch_left":
      return { opcode: ClientOpcode.PUNCH_LEFT };
    case "punch_right":
      return { opcode: ClientOpcode.PUNCH_RIGHT };
    case "block":
      return { opcode: ClientOpcode.BLOCK_START, side: blockSide };
    case "special":
      return { opcode: ClientOpcode.SPECIAL };
  }
}

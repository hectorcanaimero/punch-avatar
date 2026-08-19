const PUNCH_DURATION_MS = 180;
const HURT_DURATION_MS = 260;
const KO_DURATION_MS = 700;
const MISS_DURATION_MS = 520;
const TELEGRAPH_DURATION_MS = 360;
const IDLE_DURATION_MS = 1_200;

export type GloveSide = "left" | "right";

export interface CombatAnimationElements {
  leftGlove: HTMLElement;
  rightGlove: HTMLElement;
  rival: HTMLElement;
}

export interface CombatAnimationsOptions {
  reducedMotion?: boolean;
}

/**
 * Owns the short, cosmetic animations used by the combat screen.
 * Gameplay timing must never depend on these animations finishing.
 */
export class CombatAnimations {
  private reducedMotion: boolean;
  private readonly active = new Set<Animation>();
  private idleAnimation: Animation | null = null;

  constructor(
    private readonly elements: CombatAnimationElements,
    options: CombatAnimationsOptions = {},
  ) {
    this.reducedMotion =
      options.reducedMotion ??
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
      false;
  }

  setReducedMotion(enabled: boolean): void {
    if (this.reducedMotion === enabled) return;

    this.reducedMotion = enabled;
    this.cancelAll();
    if (!enabled) this.startRivalIdle();
  }

  startRivalIdle(): void {
    this.stopRivalIdle();
    if (this.reducedMotion) return;

    this.idleAnimation = this.elements.rival.animate(
      [
        { transform: "translateY(0) rotate(-0.5deg)" },
        { transform: "translateY(-7px) rotate(0.5deg)" },
        { transform: "translateY(0) rotate(-0.5deg)" },
      ],
      { duration: IDLE_DURATION_MS, easing: "ease-in-out", iterations: Infinity },
    );
  }

  stopRivalIdle(): void {
    this.idleAnimation?.cancel();
    this.idleAnimation = null;
  }

  punch(side: GloveSide): void {
    const glove = side === "left" ? this.elements.leftGlove : this.elements.rightGlove;
    if (this.reducedMotion) {
      this.play(glove, [{ filter: "brightness(1)" }, { filter: "brightness(1.3)" }, { filter: "brightness(1)" }], 100);
      return;
    }

    const rotation = side === "left" ? -7 : 7;
    this.play(
      glove,
      [
        { transform: `translate(0, 0) rotate(${rotation}deg) scale(1)` },
        { transform: `translate(${side === "left" ? 8 : -8}px, -44px) rotate(0deg) scale(1.08)`, offset: 0.42 },
        { transform: `translate(${side === "left" ? 3 : -3}px, -70px) rotate(0deg) scale(0.94)`, offset: 0.65 },
        { transform: `translate(0, 0) rotate(${rotation}deg) scale(1)` },
      ],
      PUNCH_DURATION_MS,
      "cubic-bezier(.2,.8,.3,1)",
    );
  }

  telegraph(side: GloveSide): void {
    const origin = side === "left" ? "35% 55%" : "65% 55%";
    this.play(
      this.elements.rival,
      [
        { filter: "drop-shadow(0 0 0 rgba(255,205,65,0))" },
        { filter: "drop-shadow(0 0 16px rgba(255,205,65,0.95))", offset: 0.5 },
        { filter: "drop-shadow(0 0 0 rgba(255,205,65,0))" },
      ],
      this.reducedMotion ? 160 : TELEGRAPH_DURATION_MS,
      "ease-in-out",
      origin,
    );
  }

  hurt(): void {
    this.stopRivalIdle();
    const frames: Keyframe[] = this.reducedMotion
      ? [{ filter: "brightness(1)" }, { filter: "brightness(1.8)" }, { filter: "brightness(1)" }]
      : [
          { transform: "translateX(0) rotate(0)", filter: "brightness(1)" },
          { transform: "translateX(18px) rotate(5deg)", filter: "brightness(1.75)", offset: 0.22 },
          { transform: "translateX(-10px) rotate(-3deg)", filter: "brightness(1.2)", offset: 0.5 },
          { transform: "translateX(0) rotate(0)", filter: "brightness(1)" },
        ];

    this.play(this.elements.rival, frames, HURT_DURATION_MS, "ease-out", undefined, () => this.startRivalIdle());
  }

  ko(): void {
    this.stopRivalIdle();
    const frames: Keyframe[] = this.reducedMotion
      ? [{ opacity: 1 }, { opacity: 0.72 }]
      : [
          { transform: "translateY(0) rotate(0) scale(1)", opacity: 1 },
          { transform: "translateY(-14px) rotate(-4deg) scale(1.03)", opacity: 1, offset: 0.18 },
          { transform: "translateY(38vh) rotate(22deg) scale(0.9)", opacity: 0.72 },
        ];

    this.play(this.elements.rival, frames, this.reducedMotion ? 120 : KO_DURATION_MS, "cubic-bezier(.4,0,1,1)", undefined, undefined, "forwards");
  }

  comicMiss(side: GloveSide): void {
    if (this.reducedMotion) return;

    const glove = side === "left" ? this.elements.leftGlove : this.elements.rightGlove;
    const direction = side === "left" ? 1 : -1;
    this.play(
      glove,
      [
        { transform: `translate(0, 0) rotate(${direction * -7}deg)` },
        { transform: `translate(${direction * 42}px, -22px) rotate(${direction * 18}deg)`, offset: 0.3 },
        { transform: `translate(${direction * 56}px, 18px) rotate(${direction * 34}deg)`, offset: 0.58 },
        { transform: `translate(${direction * -6}px, 7px) rotate(${direction * -11}deg)`, offset: 0.82 },
        { transform: `translate(0, 0) rotate(${direction * -7}deg)` },
      ],
      MISS_DURATION_MS,
      "cubic-bezier(.3,.7,.4,1.25)",
    );
  }

  dispose(): void {
    this.cancelAll();
  }

  private play(
    element: HTMLElement,
    keyframes: Keyframe[],
    duration: number,
    easing = "ease-out",
    transformOrigin?: string,
    onFinish?: () => void,
    fill: FillMode = "none",
  ): void {
    const previousOrigin = element.style.transformOrigin;
    if (transformOrigin) element.style.transformOrigin = transformOrigin;

    const animation = element.animate(keyframes, { duration, easing, fill });
    this.active.add(animation);

    const cleanup = (): void => {
      this.active.delete(animation);
      if (transformOrigin) element.style.transformOrigin = previousOrigin;
    };
    animation.addEventListener("finish", () => {
      cleanup();
      onFinish?.();
    }, { once: true });
    animation.addEventListener("cancel", cleanup, { once: true });
  }

  private cancelAll(): void {
    this.stopRivalIdle();
    for (const animation of [...this.active]) animation.cancel();
    this.active.clear();
  }
}

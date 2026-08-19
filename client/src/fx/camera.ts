const MAX_SHAKE_PX = 12;
const MAX_SHAKE_DURATION_MS = 500;
const SPECIAL_ZOOM = 1.08;
const SPECIAL_DURATION_MS = 280;
const KO_FREEZE_MS = 100;

export type CameraFxOptions = {
  reducedMotion?: boolean;
};

export class CameraFx {
  private reducedMotion: boolean;
  private activeAnimation: Animation | null = null;
  private freezeTimer: ReturnType<typeof setTimeout> | null = null;
  private frozenAnimations: Animation[] = [];

  constructor(
    private readonly camera: HTMLElement,
    options: CameraFxOptions = {},
  ) {
    this.reducedMotion =
      options.reducedMotion ??
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
      false;
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;

    if (enabled) {
      this.stopCameraAnimation();
      this.releaseFreeze();
    }
  }

  shake(intensity: number, duration: number): void {
    if (this.reducedMotion) return;

    const magnitude = clamp(intensity, 0, MAX_SHAKE_PX);
    const time = clamp(duration, 0, MAX_SHAKE_DURATION_MS);
    if (magnitude === 0 || time === 0) return;

    this.playCameraAnimation(
      shakeKeyframes(magnitude),
      { duration: time, easing: "ease-out" },
    );
  }

  specialZoom(): void {
    if (this.reducedMotion) return;

    this.playCameraAnimation(
      [
        { transform: "translate(0, 0) scale(1)" },
        { transform: `translate(-8px, 5px) scale(${SPECIAL_ZOOM})`, offset: 0.25 },
        { transform: `translate(7px, -5px) scale(${SPECIAL_ZOOM})`, offset: 0.45 },
        { transform: `translate(-4px, 3px) scale(${SPECIAL_ZOOM})`, offset: 0.65 },
        { transform: "translate(0, 0) scale(1)" },
      ],
      { duration: SPECIAL_DURATION_MS, easing: "ease-out" },
    );
  }

  freezeKo(): void {
    if (this.reducedMotion || this.freezeTimer !== null) return;

    const runningAnimations = document
      .getAnimations()
      .filter((animation) => animation.playState === "running");

    for (const animation of runningAnimations) animation.pause();
    this.frozenAnimations = runningAnimations;

    this.freezeTimer = setTimeout(() => {
      for (const animation of this.frozenAnimations) {
        if (animation.playState === "paused") animation.play();
      }
      this.frozenAnimations = [];
      this.freezeTimer = null;
    }, KO_FREEZE_MS);
  }

  dispose(): void {
    this.stopCameraAnimation();
    this.releaseFreeze();
  }

  private playCameraAnimation(
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ): void {
    this.stopCameraAnimation();
    this.activeAnimation = this.camera.animate(keyframes, options);
    this.activeAnimation.addEventListener(
      "finish",
      () => {
        this.activeAnimation = null;
      },
      { once: true },
    );
  }

  private stopCameraAnimation(): void {
    this.activeAnimation?.cancel();
    this.activeAnimation = null;
  }

  private releaseFreeze(): void {
    if (this.freezeTimer === null) return;
    clearTimeout(this.freezeTimer);
    this.freezeTimer = null;

    for (const animation of this.frozenAnimations) {
      if (animation.playState === "paused") animation.play();
    }
    this.frozenAnimations = [];
  }
}

function shakeKeyframes(magnitude: number): Keyframe[] {
  return [
    { transform: "translate(0, 0)" },
    { transform: `translate(${-magnitude}px, ${magnitude * 0.5}px)` },
    { transform: `translate(${magnitude * 0.8}px, ${-magnitude * 0.6}px)` },
    { transform: `translate(${-magnitude * 0.5}px, ${magnitude * 0.4}px)` },
    { transform: "translate(0, 0)" },
  ];
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

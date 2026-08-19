import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  COMIC_PHRASES,
  type ComicPhrase,
} from "../../../src/data/comic-phrases";

const DISPLAY_DURATION_MS = 300;
const STARTER_LEVEL = 1;

export interface ComicTextProps {
  /** Cambiá este valor cada vez que el servidor confirme un golpe conectado. */
  hitId: string | number | null;
  /** IDs persistidos en profile.unlocks, por ejemplo `phrase_zas`. */
  unlockedPhraseIds: readonly string[];
  reduceMotion?: boolean;
}

function pickUnlockedPhrase(
  unlockedPhraseIds: readonly string[],
): ComicPhrase {
  const unlocked = new Set(unlockedPhraseIds);
  const pool = COMIC_PHRASES.filter(
    ({ key, unlockLevel }) =>
      unlockLevel <= STARTER_LEVEL ||
      unlocked.has(key) ||
      unlocked.has(`phrase_${key}`),
  );

  return pool[Math.floor(Math.random() * pool.length)] ?? COMIC_PHRASES[0];
}

export function ComicText({
  hitId,
  unlockedPhraseIds,
  reduceMotion = false,
}: ComicTextProps) {
  const [phrase, setPhrase] = useState<ComicPhrase | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hitId === null) {
      setPhrase(null);
      return;
    }

    setPhrase(pickUnlockedPhrase(unlockedPhraseIds));
    const timeoutId = window.setTimeout(
      () => setPhrase(null),
      DISPLAY_DURATION_MS,
    );

    return () => window.clearTimeout(timeoutId);
  }, [hitId, unlockedPhraseIds]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || reduceMotion) return;

    const animation = overlay.animate(
      [
        { opacity: 0, transform: "translate(-50%, -50%) scale(0.35) rotate(-12deg)" },
        { opacity: 1, offset: 0.35, transform: "translate(-50%, -50%) scale(1.18) rotate(4deg)" },
        { opacity: 1, offset: 0.75, transform: "translate(-50%, -50%) scale(1) rotate(-3deg)" },
        { opacity: 0, transform: "translate(-50%, -50%) scale(1.08) rotate(2deg)" },
      ],
      { duration: DISPLAY_DURATION_MS, easing: "ease-out" },
    );

    return () => animation.cancel();
  }, [phrase, reduceMotion]);

  if (!phrase) return null;

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      ref={overlayRef}
      role="status"
      style={styles.overlay}
    >
      {phrase.text}
    </div>
  );
}

const styles: Readonly<Record<string, CSSProperties>> = {
  overlay: {
    WebkitTextStroke: "clamp(2px, 0.7vw, 5px) #17120f",
    color: "#f9d949",
    filter: "drop-shadow(8px 8px 0 #e23b2e)",
    fontFamily: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
    fontSize: "clamp(3rem, 15vw, 8rem)",
    fontStyle: "italic",
    left: "50%",
    letterSpacing: "0.02em",
    lineHeight: 0.85,
    maxWidth: "min(92vw, 760px)",
    overflowWrap: "anywhere",
    pointerEvents: "none",
    position: "fixed",
    textAlign: "center",
    textShadow: "3px 3px 0 #fff8e7",
    top: "48%",
    transform: "translate(-50%, -50%) rotate(-3deg)",
    userSelect: "none",
    zIndex: 20,
  },
};

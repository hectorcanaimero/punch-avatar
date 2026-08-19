import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  MUSIC_DEFS,
  MUSIC_TRACKS,
  SFX_DEFS,
  SFX_EVENTS,
} from "../client/src/audio/sfx-map";

const VALID_WAVES = new Set(["sine", "square", "sawtooth", "triangle"]);

describe("catálogo SFX", () => {
  test("cubre los 5 eventos requeridos (pow, whoosh, block, special, ko)", () => {
    assert.deepEqual(
      [...SFX_EVENTS].sort(),
      ["block", "ko", "pow", "special", "whoosh"],
    );
  });

  test("cada evento tiene definición con síntesis válida", () => {
    for (const event of SFX_EVENTS) {
      const def = SFX_DEFS[event];
      assert.equal(def.id, event);
      assert.ok(def.label.length > 0, `${event} debería tener label`);
      assert.ok(def.synth.durationMs > 0, `${event} durationMs > 0`);
      assert.ok(def.synth.startFreq > 0, `${event} startFreq > 0`);
      assert.ok(def.synth.endFreq > 0, `${event} endFreq > 0`);
      assert.ok(def.synth.volume >= 0 && def.synth.volume <= 1, `${event} volume 0..1`);
      assert.ok(VALID_WAVES.has(def.synth.wave), `${event} wave válido`);
    }
  });
});

describe("catálogo música", () => {
  test("cubre lobby y combat", () => {
    assert.deepEqual([...MUSIC_TRACKS].sort(), ["combat", "lobby"]);
  });

  test("cada track tiene definición con loop válido", () => {
    for (const track of MUSIC_TRACKS) {
      const def = MUSIC_DEFS[track];
      assert.equal(def.id, track);
      assert.ok(def.bpm > 0, `${track} bpm > 0`);
      assert.ok(def.steps.length > 0, `${track} steps no vacío`);
      assert.ok(
        def.steps.every((freq) => freq >= 0),
        `${track} steps con frecuencias >= 0`,
      );
      assert.ok(def.bassFreq > 0, `${track} bassFreq > 0`);
      assert.ok(def.volume >= 0 && def.volume <= 1, `${track} volume 0..1`);
      assert.ok(VALID_WAVES.has(def.wave), `${track} wave válido`);
    }
  });

  test("ambos tracks tienen al menos una nota sonora (freq > 0)", () => {
    for (const track of MUSIC_TRACKS) {
      assert.ok(
        MUSIC_DEFS[track].steps.some((freq) => freq > 0),
        `${track} debería sonar algo`,
      );
    }
  });
});

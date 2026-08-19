import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  collectExpiredRoomKeys,
  shouldSweep,
} from "../src/jobs/expire-rooms";

describe("collectExpiredRoomKeys", () => {
  test("retorna las keys con expiresAt <= now", () => {
    const objects = [
      { key: "ABC123", value: { expiresAt: 1000 } },
      { key: "DEF456", value: { expiresAt: 2000 } },
      { key: "GHI789", value: { expiresAt: 1500 } },
    ];
    assert.deepEqual(collectExpiredRoomKeys(objects, 1500), ["ABC123", "GHI789"]);
  });

  test("ignora records sin expiresAt o con tipo incorrecto", () => {
    const objects = [
      { key: "A", value: {} },
      { key: "B", value: { expiresAt: "not-a-number" } },
      { key: "C" },
      { key: "D", value: { expiresAt: 100 } },
    ];
    assert.deepEqual(collectExpiredRoomKeys(objects, 100), ["D"]);
  });

  test("no expira nada si expiresAt es futuro", () => {
    const objects = [{ key: "A", value: { expiresAt: 10_000 } }];
    assert.deepEqual(collectExpiredRoomKeys(objects, 5_000), []);
  });

  test("lista vacía → vacío", () => {
    assert.deepEqual(collectExpiredRoomKeys([], 0), []);
  });
});

describe("shouldSweep", () => {
  test("true cuando pasó el intervalo", () => {
    assert.equal(shouldSweep(0, 300_000), true);
  });

  test("false antes del intervalo", () => {
    assert.equal(shouldSweep(100_000, 399_999), false);
  });

  test("respeta un intervalo custom", () => {
    assert.equal(shouldSweep(0, 10_000, 10_000), true);
    assert.equal(shouldSweep(0, 9_999, 10_000), false);
  });
});

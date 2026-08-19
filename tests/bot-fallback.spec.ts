import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { RIVALS } from "../src/data/rivals.ts";
import {
  RANK_PER_RIVAL_STEP,
  selectBotRivalForRank,
} from "../src/matchmaker/bot-fallback.ts";

describe("selectBotRivalForRank", () => {
  test("mapea bronce base (rank 0) al rival más débil", () => {
    const { index, rival } = selectBotRivalForRank(0);
    assert.equal(index, 0);
    assert.equal(rival, RIVALS[0]);
  });

  test("respeta los bordes de cada escalón de 200 puntos ELO", () => {
    // Último punto del escalón anterior sigue en el rival inferior.
    assert.equal(selectBotRivalForRank(199).index, 0);
    // Primer punto del escalón nuevo sube de rival.
    assert.equal(selectBotRivalForRank(200).index, 1);
    assert.equal(selectBotRivalForRank(399).index, 1);
    assert.equal(selectBotRivalForRank(400).index, 2);
  });

  test("cubre los cuatro tiers (bronce → leyenda) sin repetir mapeo", () => {
    // Bronce (0-999)
    assert.equal(selectBotRivalForRank(500).index, 2);
    // Plata (1000-1399)
    assert.equal(selectBotRivalForRank(1200).index, 6);
    // Oro (1400-1799)
    assert.equal(selectBotRivalForRank(1600).index, 8);
    // Leyenda Tonta (1800+)
    assert.equal(selectBotRivalForRank(1800).index, 9);
  });

  test("satura en el rival final para ranks mayores al último escalón", () => {
    const last = RIVALS.length - 1;
    assert.equal(selectBotRivalForRank(2200).index, last);
    assert.equal(selectBotRivalForRank(9999).index, last);
    assert.equal(selectBotRivalForRank(Number.MAX_SAFE_INTEGER).index, last);
  });

  test("clampa ranks inválidos (negativos, NaN, infinitos) al rival 0", () => {
    assert.equal(selectBotRivalForRank(-100).index, 0);
    assert.equal(selectBotRivalForRank(Number.NaN).index, 0);
    assert.equal(selectBotRivalForRank(Number.POSITIVE_INFINITY).index, 0);
    assert.equal(selectBotRivalForRank(Number.NEGATIVE_INFINITY).index, 0);
  });

  test("trunca ranks fraccionales sin desplazar el escalón elegido", () => {
    // 199.999 sigue debajo de 200 → rival 0.
    assert.equal(selectBotRivalForRank(199.999).index, 0);
    // 200.5 ya cruza el escalón → rival 1.
    assert.equal(selectBotRivalForRank(200.5).index, 1);
  });

  test("el número de rivales cubiertos coincide con el roster real", () => {
    // WHY: si alguien agrega rivales pero no ajusta la constante, este test avisa.
    const topIndex = selectBotRivalForRank(
      RANK_PER_RIVAL_STEP * RIVALS.length + 5000,
    ).index;
    assert.equal(topIndex, RIVALS.length - 1);
  });
});

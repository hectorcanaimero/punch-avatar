#!/usr/bin/env node
// Análisis de balance para la carrera PvE — insumo para la sesión T-056.
//
// Uso: node scripts/simulate-balance.mjs
//
// SYNC: los constants abajo están duplicados desde src/data/rivals.ts y
// src/config/combat.ts. Si tuneás valores en el runtime, resincronizá acá
// y volvé a correr. No se auto-derivan porque el runtime es TS + Goja y
// bundlearlo desde este script complica la vida para poca ganancia.

// ---------- Datos (SYNC con src/config/combat.ts + src/data/rivals.ts) ----------

const COMBAT = {
  playerHp: 100,
  punchDamage: 8,
  specialDamage: 30,
  maxCharge: 100,
  chargePerHit: 10,
  playerReactionMs: 500, // supuesto: jugador humano razonable
};

const RIVALS = [
  { i: 0, name: "Tito Cucharón", hp: 80, dmg: 5, telegraphMs: 800, feintP: 0, comboP: 0, special: false },
  { i: 1, name: "El Bigotes", hp: 80, dmg: 5, telegraphMs: 700, feintP: 0, comboP: 0, special: false },
  { i: 2, name: "Doña Fierro", hp: 100, dmg: 7, telegraphMs: 650, feintP: 0.1, comboP: 0.15, special: false },
  { i: 3, name: "Rival 3 (desconocido)", hp: 100, dmg: 7, telegraphMs: 600, feintP: 0.15, comboP: 0.2, special: false },
  { i: 4, name: "Rival 4", hp: 110, dmg: 8, telegraphMs: 550, feintP: 0.2, comboP: 0.25, special: false },
  { i: 5, name: "Rival 5", hp: 120, dmg: 9, telegraphMs: 500, feintP: 0.2, comboP: 0.3, special: true },
  { i: 6, name: "Rival 6", hp: 130, dmg: 10, telegraphMs: 450, feintP: 0.25, comboP: 0.35, special: true },
  { i: 7, name: "Rival 7", hp: 140, dmg: 11, telegraphMs: 400, feintP: 0.3, comboP: 0.4, special: true },
  { i: 8, name: "Rival 8", hp: 150, dmg: 12, telegraphMs: 350, feintP: 0.35, comboP: 0.45, special: true },
  { i: 9, name: "Campeón", hp: 200, dmg: 15, telegraphMs: 300, feintP: 0.4, comboP: 0.5, special: true },
];

// ---------- Modelo simplificado ----------

// Player: intenta bloquear si telegraph <= reactionTime, sino recibe golpe.
// Asumimos que el jugador humano tarda ~500ms entre input + reacción a telegraph
// (variable per playtester — es un baseline razonable).
//
// Fórmulas:
//   blockSuccessRate = min(1, telegraphMs / playerReactionMs) → si telegraph
//     es 500ms y jugador reacciona en 500ms, block rate ≈ 100%; si telegraph
//     es 300ms (campeón), block rate ≈ 60%.
//   playerAvgDmgTaken = rival.dmg * (1 - blockSuccessRate)
//   rivalHitFrequency = 1000 / (telegraphMs + 200ms recovery)
//   ttkPlayer = playerHp / (rivalAvgDmgTaken * rivalHitFrequency)
//   playerHitFreq = 1000 / (300ms swing + 100ms recovery) = 2.5/s
//   ttkRival = rival.hp / (COMBAT.punchDamage * playerHitFreq)
//   difficultyRatio = ttkPlayer / ttkRival
//     >1 → jugador tiene ventaja (fácil)
//     ~1 → parejo
//     <1 → rival tiene ventaja (difícil)

function analyzeRival(rival) {
  const blockRate = Math.min(1, rival.telegraphMs / COMBAT.playerReactionMs);
  const feintPenalty = rival.feintP * 0.3; // feints obligan a defender de más
  const effectiveBlock = Math.max(0, blockRate - feintPenalty);
  const avgDmgTaken = rival.dmg * (1 - effectiveBlock);
  const rivalHitFreq = 1000 / (rival.telegraphMs + 200);
  const comboMultiplier = 1 + rival.comboP * 0.5; // combos = más golpes/seg efectivos
  const dmgPerSec = avgDmgTaken * rivalHitFreq * comboMultiplier;
  const ttkPlayer = dmgPerSec > 0 ? COMBAT.playerHp / dmgPerSec : Infinity;
  const playerHitFreq = 2.5;
  const ttkRival = rival.hp / (COMBAT.punchDamage * playerHitFreq);
  const ratio = ttkPlayer / ttkRival;
  return {
    ...rival,
    blockRate: (effectiveBlock * 100).toFixed(0) + "%",
    dmgPerSec: dmgPerSec.toFixed(1),
    ttkPlayerSec: ttkPlayer.toFixed(1),
    ttkRivalSec: ttkRival.toFixed(1),
    ratio: ratio.toFixed(2),
    verdict: verdictFor(ratio, rival.i),
  };
}

function verdictFor(ratio, index) {
  // Curva esperada: rivales 0-2 fáciles (ratio > 1.5), rivales 3-5 parejo
  // (1.0-1.5), rivales 6-8 difícil (0.7-1.0), campeón muy difícil (~0.6).
  const target =
    index <= 2 ? [1.5, 3.0] : index <= 5 ? [1.0, 1.5] : index <= 8 ? [0.7, 1.0] : [0.5, 0.75];
  const [lo, hi] = target;
  if (ratio > hi) return `TOO EASY (esperado ${lo.toFixed(1)}-${hi.toFixed(1)})`;
  if (ratio < lo) return `TOO HARD (esperado ${lo.toFixed(1)}-${hi.toFixed(1)})`;
  return `OK (${lo.toFixed(1)}-${hi.toFixed(1)})`;
}

// ---------- Special charge analysis ----------

function analyzeSpecial() {
  const hitsToCharge = COMBAT.maxCharge / COMBAT.chargePerHit;
  const playerHitFreq = 2.5;
  const secondsToCharge = hitsToCharge / playerHitFreq;
  const specialDmgVsNormal = COMBAT.specialDamage / COMBAT.punchDamage;
  return {
    hitsToCharge,
    secondsToCharge: secondsToCharge.toFixed(1),
    specialDmgMultiplier: specialDmgVsNormal.toFixed(2) + "x",
    equivalentPunches: (COMBAT.specialDamage / COMBAT.punchDamage).toFixed(1),
  };
}

// ---------- Output ----------

function pad(s, width) {
  const str = String(s);
  return str.length >= width ? str : str + " ".repeat(width - str.length);
}

function printReport() {
  console.log("");
  console.log("═".repeat(110));
  console.log("  PUNCH AVATAR — Análisis de balance PvE (insumo para T-056)");
  console.log("═".repeat(110));
  console.log("");
  console.log(`  Asunciones: playerHp=${COMBAT.playerHp}, punchDmg=${COMBAT.punchDamage}, reactionMs=${COMBAT.playerReactionMs}`);
  console.log(`              playerHitFreq=2.5/s, rivalRecoveryMs=200`);
  console.log("");
  console.log(
    pad("Rival", 22) +
    pad("HP", 5) +
    pad("Dmg", 5) +
    pad("TelegMs", 9) +
    pad("Block%", 8) +
    pad("Dmg/s", 8) +
    pad("TTKplr", 8) +
    pad("TTKriv", 8) +
    pad("Ratio", 8) +
    "Verdict",
  );
  console.log("─".repeat(110));
  for (const rival of RIVALS) {
    const a = analyzeRival(rival);
    console.log(
      pad(`${a.i}. ${a.name}`, 22) +
      pad(a.hp, 5) +
      pad(a.dmg, 5) +
      pad(a.telegraphMs + "ms", 9) +
      pad(a.blockRate, 8) +
      pad(a.dmgPerSec, 8) +
      pad(a.ttkPlayerSec + "s", 8) +
      pad(a.ttkRivalSec + "s", 8) +
      pad(a.ratio, 8) +
      a.verdict,
    );
  }
  console.log("");
  console.log("─".repeat(110));
  console.log("  SPECIAL (carga)");
  console.log("─".repeat(110));
  const s = analyzeSpecial();
  console.log(`  Hits necesarios para cargar 100%: ${s.hitsToCharge}`);
  console.log(`  Segundos aprox de golpeo activo:  ${s.secondsToCharge}s`);
  console.log(`  Daño special vs normal:           ${s.specialDmgMultiplier} (${s.equivalentPunches} punches equivalentes)`);
  console.log("");
  console.log("═".repeat(110));
  console.log("  NOTAS PARA EL PLAYTEST T-056");
  console.log("═".repeat(110));
  console.log("");
  console.log("  1. Los verdicts asumen jugador con reacción 500ms — humanos varían de 250ms");
  console.log("     (twitch gamers) a 800ms (casual). Correr con 3-5 skill levels distintos.");
  console.log("  2. Ratio no captura feints/combos con precisión — el 'feel' de tramposo del");
  console.log("     rival 5+ requiere observación humana.");
  console.log("  3. Registrar en docs/balance-notes.md cada ajuste propuesto y por qué.");
  console.log("  4. Después del playtest: re-editar RIVALS al TOP de este script y correr");
  console.log("     de nuevo para ver si los verdicts se alinean con la sensación real.");
  console.log("");
}

printReport();

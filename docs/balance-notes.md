# Balance Notes — Punch Avatar

Registro vivo de decisiones de balance del combate PvE (carrera) y ranked.
Cada cambio de valor en `src/data/rivals.ts`, `src/config/combat.ts` o
`src/config/xp.ts` **debe** documentarse acá con: valor previo, valor nuevo,
motivo, evidencia (playtest o simulación).

---

## Cómo usar este archivo

1. **Antes del playtest**: correr `node scripts/simulate-balance.mjs` para
   ver el baseline actual. Anotar los outliers (verdict `TOO EASY` /
   `TOO HARD`) en la sección "Baseline" abajo.
2. **Durante el playtest**: usar la sección "Sesión de playtest" para
   registrar observaciones de cada tester por rival.
3. **Después del playtest**: consolidar en "Ajustes propuestos" y aplicar
   en el código. Re-correr el simulador para confirmar que los verdicts
   se movieron en la dirección esperada.

---

## Baseline (2026-08-19, pre-T-056)

Resultado de `simulate-balance.mjs` con los valores actuales de
`src/data/rivals.ts` y `src/config/combat.ts`:

| Rival | HP | Dmg | Telegraph | Ratio | Verdict |
|---|---|---|---|---|---|
| 0. Tito Cucharón | 80 | 5 | 800ms | ∞ | TOO EASY (esperado 1.5-3.0) |
| 1. El Bigotes | 80 | 5 | 700ms | ∞ | TOO EASY (esperado 1.5-3.0) |
| 2. Doña Fierro | 100 | 7 | 650ms | 75.3 | TOO EASY (esperado 1.5-3.0) |
| 3. Rival 3 | 100 | 7 | 600ms | 46.2 | TOO EASY (esperado 1.0-1.5) |
| 4. Rival 4 | 110 | 8 | 550ms | 25.3 | TOO EASY (esperado 1.0-1.5) |
| 5. Rival 5 | 120 | 9 | 500ms | 18.8 | TOO EASY (esperado 1.0-1.5) |
| 6. Rival 6 | 130 | 10 | 450ms | 4.9 | TOO EASY (esperado 0.7-1.0) |
| 7. Rival 7 | 140 | 11 | 400ms | 2.2 | TOO EASY (esperado 0.7-1.0) |
| 8. Rival 8 | 150 | 12 | 350ms | 1.2 | TOO EASY (esperado 0.7-1.0) |
| 9. Campeón | 200 | 15 | 300ms | 0.5 | OK (0.5-0.8) |

**Observaciones baseline** (a validar en playtest):

- Curva **muy plana**: los primeros 8 rivales son trivialmente derrotables
  bajo el modelo simple. Solo el campeón representa desafío real.
- Telegraph windows generosos (500-800ms) permiten block rate cercano al
  100% para rivales 0-5. La diversión emerge recién en rivales 6+.
- Riesgo: jugadores casuales pueden completar el 80% del roster sin
  aprender mecánicas (no bloquean porque no lo necesitan). Al llegar al
  campeón mueren de golpe y abandonan.
- Special: 4s de golpeo para full charge, luego 3.75× normal damage —
  probablemente OK, verificar en playtest si se siente cheesy o épico.

---

## Guía para playtesters humanos

**Antes de arrancar**:
- Sesión de 45-60 min por playtester.
- Cada playtester recorre la carrera de rival 0 a 9 sin repetir intentos.
- Anotar cuánto tarda por rival (segundos) y en cuántos intentos lo pasa.

**Durante cada match**, prestá atención a:
- **Ritmo**: ¿el match se siente muy corto? ¿muy largo? ¿se estira?
- **Telegraph legibilidad**: ¿ves venir el golpe? ¿te toma por sorpresa?
- **Feints (rivales 3+)**: ¿te confunden? ¿te enseñan a leer al rival?
- **Combos (rivales 4+)**: ¿te dan chance de reaccionar? ¿te desarman?
- **Special del rival (rivales 5+)**: ¿lo ves cargar? ¿te da miedo?
- **Tu propio special**: ¿lo llegás a usar? ¿se siente potente?
- **Frustración vs desafío**: ¿morir se siente injusto o "voy a poder"?

**Escala rápida por rival** (marcar en la tabla de la sesión):
- Dificultad: 1 (trivial) → 5 (imposible)
- Diversión: 1 (aburrido) → 5 (adictivo)
- Justicia: 1 (tramposo) → 5 (justo)

---

## Sesión de playtest — [FECHA]

**Playtesters**:
- Alice (skill: intermedia, reacción ~500ms)
- Bob (skill: casual, reacción ~750ms)
- Carla (skill: gamer, reacción ~300ms)

### Rival por rival

| Rival | Alice (D/F/J) | Bob (D/F/J) | Carla (D/F/J) | Notas comunes |
|---|---|---|---|---|
| 0. Tito Cucharón | -/-/- | -/-/- | -/-/- | |
| 1. El Bigotes | -/-/- | -/-/- | -/-/- | |
| 2. Doña Fierro | -/-/- | -/-/- | -/-/- | |
| 3. Rival 3 | -/-/- | -/-/- | -/-/- | |
| 4. Rival 4 | -/-/- | -/-/- | -/-/- | |
| 5. Rival 5 | -/-/- | -/-/- | -/-/- | |
| 6. Rival 6 | -/-/- | -/-/- | -/-/- | |
| 7. Rival 7 | -/-/- | -/-/- | -/-/- | |
| 8. Rival 8 | -/-/- | -/-/- | -/-/- | |
| 9. Campeón | -/-/- | -/-/- | -/-/- | |

Convención: D = Dificultad, F = Diversión, J = Justicia (1-5 c/u).

### Observaciones cualitativas

- [ ] Momento "wow" (¿en qué rival aparece?):
- [ ] Momento "quiero abandonar" (¿si existió?):
- [ ] Feature más querido:
- [ ] Feature más frustrante:

---

## Ajustes propuestos

Cada ajuste registrarse con formato:

### Ajuste #N — [YYYY-MM-DD]

- **Target**: `src/data/rivals.ts` línea X, campo Y
- **Antes**: `{ hp: 100, dmg: 7 }`
- **Después**: `{ hp: 120, dmg: 8 }`
- **Motivo**: 2/3 playtesters pasaron sin recibir daño (dificultad 1/5).
  Simulador post-cambio da ratio 1.4 (dentro del target 1.0-1.5).
- **Evidencia**: sesión 2026-08-19, tabla arriba + baseline simulator.
- **Commit**: `<hash>`

---

## Ajustes de special / champion HP

Registrar cambios a `src/config/combat.ts` (maxCharge, punchDamage,
specialDamage, chargePerHit) y HP del campeón acá.

---

## Historial de re-corridas del simulador

Después de cada ajuste, correr `node scripts/simulate-balance.mjs` y pegar
la tabla resumida acá para trackear si los verdicts se están alineando
con el feel real.

| Fecha | Cambios | Rivales OK | Rivales fuera de target |
|---|---|---|---|
| 2026-08-19 (baseline) | ninguno | 1/10 (solo campeón) | 9/10 |

# Spec 06 — Gamificación (XP, Niveles, Logros, Leaderboards)

**Ref PRD:** §4 Gamificación.

## Objetivo
Progresión persistente que da sensación de avance sin romper el balance del combate.

## Alcance
- **XP** (server-side, en `matchTerminate` hook):
  - +50 victoria, +10 derrota (participación), +20 K.O. limpio, +100 primera victoria contra rival de Carrera.
- **Niveles**: fórmula `xpNeeded(n) = 100 * n^1.5` (curva suave). Al subir nivel, otorga unlock cosmético según tabla.
- **Unlocks cosméticos** (guardados en `profile.unlocks[]`):
  - Nuevos guantes (skins), nuevos estilos de avatar, nuevas frases cómicas al golpear.
  - Zero impacto en balance — solo visual/audio.
- **Frases cómicas**: pool creciente (`POW`, `BONK`, `ZAS`, `CATAPLUM`, `¡MADRE!`, `¡AY!`, etc.), rotativas al conectar.
- **Logros** (colección `achievements` en Storage; Nakama no trae achievements nativos):
  - `first_blood` — primer K.O.
  - `cara_de_piedra` — ganar sin recibir un golpe.
  - `remontada` — ganar con < 10 HP.
  - `campeon` — vencer al rival 10 de Carrera.
  - Verificados en `matchTerminate`; idempotentes (no re-otorgan).
- **Leaderboards** (Nakama API):
  - `most_kos` — total KOs global.
  - `current_streak` — racha actual de victorias.
- UI cliente: pantalla perfil (nivel, xp, stats, logros), pantalla unlocks (skins/frases desbloqueadas y bloqueadas).

## Fuera de alcance
Batalla monetizada, Battle Pass, monedas premium.

## Criterios de aceptación
- Subir de nivel dispara animación + notificación.
- Logros se otorgan una sola vez, incluso si se cumplen condiciones múltiples veces.
- Leaderboards reflejan estado en < 30 seg tras match.
- Cosméticos no dan ventaja mecánica alguna (verificable auditando código de combate).

## Riesgos
- Curva de XP muy dura o muy suave — ajustable vía constantes.

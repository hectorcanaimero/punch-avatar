# Spec 05 — Modo Carrera (PvE)

**Ref PRD:** §1 Modos, §2 Modo Carrera, §5 Match handler (variante bot).

## Objetivo
Escalera de 10 rivales IA con patrones telegrafiados y dificultad progresiva estilo Punch-Out.

## Alcance
- Data estática de roster (10 rivales con nombres tontos: Tito Cucharón, El Bigotes, Doña Fierro, Máquina de Tamales, etc. + campeón final).
- Parámetros por rival según tabla del PRD §2 (telegraph window, feint %, combo %, HP, daño).
- Motor de patrones (server-side dentro del match handler, modo `career`):
  - Máquina de estados: `idle → telegraph → strike → recover`.
  - Selector de acción: elige golpe izq/der/feint/combo según probabilidades del rival.
  - Emite opcode `TELEGRAPH` (con lado) al cliente antes del golpe.
  - Tras ventana, emite `STRIKE` o `FEINT_END`.
- A partir del rival 6: puede usar especial (telegraph largo, muy visible, ignora bloqueo).
- Rival puede tener 2-3 caídas antes del K.O. final (contador de knockdowns).
- Al vencer: incrementa `careerProgress` en perfil, otorga XP (spec 06).
- Al perder: no penaliza progreso, permite reintento inmediato.
- UI cliente: pantalla escalera con retratos de rivales, bloqueados salvo el actual y los ya vencidos.

## Fuera de alcance
Dificultad adaptativa, rivales generados por IA (roster es data curada).

## Criterios de aceptación
- Cada rival se siente distinguible en patrón, no solo en HP.
- Al vencer al rival N, el rival N+1 queda desbloqueado y se guarda progreso.
- Rival 10 (campeón) es reto claro pero superable con lectura.
- Feints funcionan: penalizan bloqueo reflejo, recompensan lectura.

## Riesgos
- Balance requiere playtesting iterativo — parametrizar todo en config, no hardcodear.

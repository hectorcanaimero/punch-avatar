# Spec 07 — Versus Ranked (Matchmaker + Elo)

**Ref PRD:** §6 Ranked.

## Objetivo
PvP con emparejamiento automático por rango, cálculo Elo autoritativo en servidor, tiers visibles.

## Alcance
- `rankScore` en perfil, default 1000.
- Cliente: `matchmakerAdd` con propiedad numérica `rankScore` y query inicial `rankScore ± 150`.
- Widening automático server-side (o cliente que reintenta):
  - Tras 10s → `± 250`.
  - Tras 20s → `± 400`.
  - Tras 30s → ofrecer pelea vs bot (spec 05 reutiliza motor).
- Match handler acepta `mode: 'ranked'` — misma lógica de combate, pero al terminar:
  ```
  esperado_A = 1 / (1 + 10^((rankScore_B - rankScore_A) / 400))
  nuevo_rankScore_A = rankScore_A + K * (resultado_A - esperado_A)
  K = 24
  K.O. limpio → +5 bonus rankScore
  ```
- Cálculo 100% server-side dentro de `matchTerminate` hook.
- Tiers derivados de `rankScore`:
  | Tier | Rango |
  |---|---|
  | Bronce | 0-999 |
  | Plata | 1000-1399 |
  | Oro | 1400-1799 |
  | Leyenda Tonta | 1800+ |
- Abandono en `active` → derrota automática, se registra y actualiza rango.
- UI cliente: pantalla "buscar partida", indicador de rango ampliándose, badge de tier en perfil.

## Fuera de alcance
Decaimiento por inactividad (opcional post-MVP), rangos por temporada.

## Criterios de aceptación
- Cliente que manipule `rankScore` en payload → ignorado; servidor lee desde Storage.
- Bot fallback funciona sin romper flow.
- Elo simétrico: si A gana +X, B pierde -X (aprox, con K constante).
- Abandonos penalizan igual que derrota.

## Riesgos
- K=24 puede sentirse alto/bajo — dejar configurable.
- Bot fallback debe ser distinguible visualmente para no confundir jugadores ("estás peleando contra CPU").

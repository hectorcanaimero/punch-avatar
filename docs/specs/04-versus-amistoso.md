# Spec 04 — Versus Amistoso (Código de Sala)

**Ref PRD:** §6 Amistoso.

## Objetivo
Modo PvP con código de sala corto para jugar con amigos. No afecta rango ni leaderboards.

## Alcance
- RPC `create_friendly_room`: genera código 6 caracteres alfanumérico (excluye 0/O/1/I), crea match con `nk.matchCreate('combat', { mode: 'friendly', code })`.
- Registro código → matchId en Nakama Storage (colección `rooms`) con TTL 15 min.
- RPC `join_friendly_room`: busca por código, retorna matchId para que cliente haga `matchJoin`.
- Match handler acepta hasta 2 jugadores en modo friendly; rechaza el tercero.
- Sala expira si en 5 min no llega segundo jugador.
- UI cliente: pantalla "crear sala" (muestra código copiable) y "unirse" (input código).
- Al terminar match friendly, NO se actualiza rankScore (pero sí XP participación).

## Fuera de alcance
Chat de voz, espectadores, revancha automática.

## Criterios de aceptación
- Código único no colisiona (verificado antes de crear).
- Sala expira y libera código tras timeout.
- Match friendly termina y ambos jugadores vuelven al lobby sin cambio de rango.

## Riesgos
- Colisión de código en alto volumen — usar 6 chars = 30^6 ≈ 730M combinaciones, suficiente.

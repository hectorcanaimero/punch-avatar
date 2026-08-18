# Spec 03 — Combate Core (Match Handler Autoritativo)

**Ref PRD:** §2 Mecánica, §5 Match handler.

## Objetivo
Implementar el match handler autoritativo de Nakama que gobierna la pelea en tiempo real. Toda validación (vida, golpe, bloqueo, especial) vive en servidor.

## Alcance
- Funciones estándar Nakama: `matchInit`, `matchJoinAttempt`, `matchJoin`, `matchLeave`, `matchLoop`, `matchTerminate`, `matchSignal`.
- Estado en memoria por match:
  ```
  players: {
    [sessionId]: { userId, avatarUrl, health: 100, blocking: false, charge: 0, stance }
  }
  status: 'waiting' | 'countdown' | 'active' | 'ko' | 'ended'
  winner: userId | null
  tickRate: 10  // 10 Hz autoritativo
  ```
- Opcodes de mensajes cliente → servidor:
  - `1` PUNCH_LEFT
  - `2` PUNCH_RIGHT
  - `3` BLOCK_START
  - `4` BLOCK_END
  - `5` SPECIAL
- Reglas (todas server-side):
  - Golpe conecta si oponente NO bloquea del lado correcto → 8 HP daño.
  - Bloqueo del lado correcto → 0 daño.
  - Especial requiere `charge >= 100`, ignora bloqueo, 30 HP, resetea charge.
  - Cada golpe conectado (dado o recibido) suma +10 charge a ambos jugadores.
  - HP ≤ 0 → K.O., transiciona a `ended`, marca winner.
  - Golpe fallido cómico: 5% probabilidad → self-stagger, vulnerable 500ms.
- Broadcast de estado a clientes a cada tick (delta compactado).
- `matchTerminate` invoca hook para actualizar Storage (stats) y leaderboards (spec 06).

## Fuera de alcance
UI cliente, avatar 3D — esta spec es solo servidor.

## Criterios de aceptación
- Cliente que mande PUNCH_LEFT sin autoridad (ej. HP manipulado) es ignorado — solo el servidor calcula.
- Tick loop estable a 10 Hz sin drift (< 5ms varianza).
- Match completo (2 jugadores, K.O.) sin desync visible entre clientes.
- Al desconectarse un jugador durante `active`, se marca como derrota automática.

## Riesgos
- Latencia jugador vs autoridad — implementar client-side prediction cosmético (animación local instantánea, corrección si el server difiere).
- Complejidad de sincronización — mantener el state mínimo y opcodes bien definidos.

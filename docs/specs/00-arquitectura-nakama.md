# Spec 00 — Arquitectura Nakama (Fundación)

**Ref PRD:** §5 Arquitectura técnica.

## Objetivo
Levantar la infraestructura base: Nakama OSS + Postgres en Docker, runtime TypeScript configurado, esqueleto de RPCs y match handler listos para que el resto de specs enchufen su lógica.

## Alcance
- `docker-compose.yml` con servicios `nakama` y `postgres`.
- Config `nakama.yml` con `runtime.js_entrypoint` apuntando al bundle TS compilado.
- Proyecto TS: `tsconfig.json`, `package.json`, script de build (esbuild o rollup) hacia `build/index.js`.
- `main.ts` de entrada con `InitModule` registrando RPCs y match handler vacíos.
- Healthcheck: `curl :7350/healthcheck` responde 200.

## Fuera de alcance
Lógica de negocio (auth, avatar, combate) — solo el esqueleto y compilación.

## Criterios de aceptación
- `docker compose up` deja Nakama corriendo con Postgres saludable.
- Consola de Nakama accesible en `:7351`.
- Un RPC dummy `ping` responde `{"pong": true}` desde el runtime TS.
- Match handler dummy se puede crear vía `nk.matchCreate` sin error.

## Riesgos
- Versión de Nakama vs TS runtime (Goja) — fijar versión en compose.
- `es2020` target obligatorio en tsconfig (Goja no soporta ES2022+).

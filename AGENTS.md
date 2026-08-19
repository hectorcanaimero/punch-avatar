# AGENTS.md — Punch Avatar

Instrucciones obligatorias para cualquier agente (Claude, OpenCode, DeepSeek, LLM local, etc.) que trabaje sobre este repo. Leé este archivo entero antes de tocar código.

---

## Rol

Sos un **agente ejecutor de tareas**. Tu trabajo es:
1. Elegir una tarea del backlog.
2. Ejecutarla completa siguiendo las specs.
3. Dejar registro (status + comentario) para que el próximo agente sepa qué pasó.

No sos un arquitecto libre. La arquitectura ya está definida en `docs/PRD.md` y las specs. Tu misión es implementar lo que ya está pensado — con buen criterio técnico, no con creatividad de scope.

---

## Contexto del proyecto (30 segundos)

- **Juego**: Punch-Out multiplayer con avatares generados por IA a partir de la foto del jugador.
- **Backend**: Nakama OSS self-hosted, runtime **TypeScript** (motor Goja).
- **Match handler autoritativo**: todo estado de combate (vida, bloqueo, carga, KO) vive y se valida en el servidor. Cliente solo renderiza y envía inputs.
- **Modos**: Career (PvE contra roster IA con patrones telegrafiados) + Versus (amistoso por código + ranked con Elo).
- **Avatar IA**: pipeline Replicate InstantID identity-preserving, una generación por estilo, cacheada en perfil.
- **Progresión**: XP, niveles, unlocks 100% cosméticos, leaderboards, logros, rango Elo.

Diseño completo → `docs/PRD.md`. Specs por fase → `docs/specs/`. Backlog atómico → `docs/tasks.json`.

---

## Fuente de verdad

| Archivo | Qué contiene |
|---|---|
| `docs/PRD.md` | Diseño y arquitectura completa. La referencia. |
| `docs/specs/00..08-*.md` | Una spec por fase: objetivo, alcance, criterios de aceptación, riesgos. |
| `docs/tasks.json` | 56 tareas atómicas. Campos: `id`, `phase`, `title`, `description`, `model`, `reason`, `status`, `dependencies`, `estimateHours`, `files`, `comments`. |
| `docs/dashboard/index.html` | Visualización del backlog. Abrí con `open docs/dashboard/index.html`. |
| `scripts/ale.mjs` | **Ale** — orquestrador que elige la próxima ready task y la despacha al CLI correcto según `task.model`. Ver sección "Ale" más abajo. |

**En caso de conflicto**: PRD > specs > tasks. Si detectás inconsistencia, dejá un comment en la task y pausá.

---

## Ciclo de vida de una tarea

### Paso 1 — Elegir tarea

1. Abrí `docs/tasks.json` (o el dashboard).
2. Filtrá tareas con `status === "todo"` **y todas las dependencias en `done`**. En el dashboard aparecen con badge dorado `READY TO FIGHT`.
3. Verificá que el campo `model` de la task matchee con vos. El formato es un **ID completo de OpenCode**:
   - `opencode/<name>` → plan **Zen** (pay-as-you-go, catálogo completo curated).
   - `opencode-go/<name>` → plan **Go** (subscripción con límites $12/5h · $30/sem · $60/mes, open models baratos).
   - Catálogo completo: ver `docs/OPENCODE.md`. Ejemplos:
     - `opencode/claude-opus-4-7`, `opencode/claude-sonnet-4-6`
     - `opencode/gpt-5.6-sol`, `opencode/gpt-5.4`, `opencode/gpt-5.5`
     - `opencode/gemini-3.1-pro`
     - `opencode/grok-4.6`
     - `opencode/kimi-k3`, `opencode/qwen3.7-max`
     - `opencode-go/glm-5.1`, `opencode-go/minimax-m2.5`, `opencode-go/mimo-v2.5`
     - `opencode-go/deepseek-v4-flash`, `opencode-go/qwen3.8-max`
4. **Si sos otro modelo**: podés tomar la task, pero dejá un comment al terminar explicando la sustitución y por qué fue OK.

**Estrategia de tiers** (ver también `meta.modelStrategy` en `tasks.json`):
- **Premium**: server authority, matemática crítica, decisiones costosas → `claude-opus-4-7`, `gpt-5.6-sol`, `gemini-3.1-pro`, `deepseek-v4-pro`
- **Standard**: integraciones, UI compleja, RPCs → `claude-sonnet-4-6`, `gpt-5.4/5.5`, `grok-4.6`, `kimi-k3`, `qwen3.7-max`
- **Cheap**: config, static data, forms simples, tests puros → `glm-5.1`, `minimax-m2.5`, `mimo-v2.5`, `deepseek-v4-flash` (todos vía `opencode-go/*`)

### Paso 2 — Abrir la tarea

1. Leé la spec de la fase correspondiente (`docs/specs/{spec}.md`).
2. Leé `title`, `description`, `dependencies`, `files` de la task.
3. Marcá la task como `in-progress` en `docs/tasks.json`. Esto le dice al resto que estás trabajando en eso.

### Paso 3 — Ejecutar

1. Escribí el código en los `files` listados. Si hace falta más o menos archivos, justificalo en el comment final.
2. Seguí las **buenas prácticas** de la sección más abajo.
3. **No agregues features fuera del scope de la task.** Bug fix ≠ refactor grande. Feature nueva ≠ oportunidad de rediseñar un módulo.
4. Si al ejecutar descubrís que la task depende de algo no listado en `dependencies`, hay dos opciones:
   - Es trivial: resolvelo y notalo en el comment.
   - Es task real: marcá la actual como `blocked`, dejá comment sugiriendo la task faltante.

### Paso 4 — Verificar

Antes de decir "está listo":

- **Código de servidor (TS runtime)**: `docker compose up`, verificá que Nakama arranca sin errores en logs, que los RPCs registrados aparecen.
- **Funciones puras**: agregá o corré unit tests. Cero funciones puras sin test.
- **RPCs**: probá con Nakama console o `curl` que responde el shape correcto.
- **UI**: abrí el flow en el browser, hacé el happy path y al menos un edge case.
- **Tests**: si la task incluye tests, deben pasar todos.

**Nunca claimes "done" sin evidencia real de que corre.**

### Paso 5 — Finalizar (los 3 pasos son OBLIGATORIOS, en este orden)

> **⚠️ Regla dura del proyecto**: una task no está terminada hasta que los tres pasos siguientes están hechos. Sin excepciones. Si te falta alguno, la task queda **incompleta** y el próximo agente no puede confiar en el estado del repo.

**1. Actualizá `status` en `docs/tasks.json`**:
   - `done` — completa y verificada (Paso 4).
   - `blocked` — no pudiste terminar por dependencia externa o ambigüedad; explicá en el comment.
   - Volvé a `todo` solo si abandonás la task para que otro la tome.
   - **Nunca dejes la task en `in-progress`** al terminar tu turno. Es un huérfano — el próximo agente no sabe si estás corriendo o crasheaste.

**2. Agregá un comment** al array `comments` de la task:
   ```json
   {
     "author": "opencode-go/glm-5.1",
     "text": "Implementado. docker-compose expone 7350/7351/7349. Healthcheck de postgres tarda ~5s en primer boot.",
     "ts": "2026-08-19T14:32:11Z"
   }
   ```
   - `author` = model id completo (ej. `opencode/claude-sonnet-4-6`, `opencode-go/mimo-v2.5`, `claude-opus-4-7`), o `"human"` si fue un humano.
   - `ts` = ISO 8601 UTC.
   - Contenido según sección "Formato del comment" más abajo.

**3. Sincronizá el dashboard** con el estado actualizado de `tasks.json`:
   ```bash
   node scripts/ale.mjs sync
   ```
   Esto reescribe `docs/dashboard/index.html` reflejando tu status + comment. **Siempre corré esto antes del commit** — el dashboard es la vista canónica del progreso para el resto del equipo, tiene que estar al día.

**4. Commit + push a git — SIEMPRE, sin excepción**:
   ```bash
   git add <archivos-de-tu-task> docs/tasks.json docs/dashboard/index.html
   git commit -m "feat(scope): descripción corta (T-XXX)"
   git push
   ```
   - **Conventional commits**: `feat(auth): validador username (T-006)`, `fix(elo): cap rankScore >= 0 (T-045)`.
   - **Un commit = una task** cerrada. Incluí SIEMPRE `docs/tasks.json` (tu status update) en el mismo commit que el código. Sin eso, tu trabajo queda en el árbol pero no queda registrado en la historia del proyecto.
   - Incluí también `docs/dashboard/index.html` si cambió (auto-sync de Ale).
   - **Nunca** agregues `Co-Authored-By` ni menciones a agentes en el mensaje.
   - **Nunca** hagas `git push --force` a `main`.
   - Si el `git push` es rechazado (non-fast-forward): `git pull --rebase origin main` y volvé a intentar. No `--force`.
   - Si tenés archivos sin trackear que no son tuyos (otro agente en paralelo), agregá SOLO los tuyos por nombre — no uses `git add -A` ni `git add .` a ciegas.

**Regla de oro**: si tu task quedó `done` en `tasks.json` pero NO commiteaste + pusheaste, para el resto del mundo tu task **no existe**. El próximo agente que haga `git pull` va a ver `status=todo` y va a hacer el trabajo de nuevo. Peor: dos agentes editando el mismo archivo en paralelo = merge conflict que rompe el flow.

### Checklist final (releé esto ANTES de reportar "done")

- [ ] Código en los archivos correctos, según `task.files`.
- [ ] Tests corridos y pasando (typecheck + build + suites relevantes).
- [ ] Verificación real de que corre (Nakama boot, curl al RPC, etc. según Paso 4).
- [ ] `docs/tasks.json` con `status="done"` y comment nuevo con `author`, `text`, `ts`.
- [ ] `node scripts/ale.mjs sync` ejecutado — dashboard al día.
- [ ] `git add` con los archivos justos (tuyos + tasks.json + dashboard).
- [ ] `git commit` con mensaje conventional, sin `Co-Authored-By`.
- [ ] `git push` exitoso (si falla non-fast-forward: `git pull --rebase` primero).

Si algún item queda sin marcar, tu task **NO ESTÁ TERMINADA**. Marcala como `blocked` y dejá un comment explicando qué falta.

---

## Formato del comment

- **Corto**: 1-3 líneas, máximo ~250 caracteres.
- **Concreto**: qué se hizo, archivos clave, gotchas si los hubo.
- **Útil para el próximo agente**: mencioná decisiones no obvias, deps ocultas, valores default que elegiste.
- **Sin fluff**: nada de "trabajé duro", "espero que sirva", "quedó bien". No es un blog.
- **En español**: consistencia con el proyecto.

### Buenos ejemplos

- `"Implementado. Regex ^[a-zA-Z0-9]{3,20}$. Reservadas: admin/root/null/nakama. Testeado con 8 casos."`
- `"Bloqueado: face-api.js requiere descargar modelos en /public/models. Falta task previa para eso."`
- `"Done. Elo K=24, bonus KO limpio +5. Simetría verificada. Nota: cap rankScore a 0 para evitar negativos."`
- `"Done pero notar: cambié id de opcode SPECIAL de 5 a 10 porque colisiona con futuro FEINT. Actualizar cliente."`

### Malos ejemplos

- `"Listo"` (inútil)
- `"Terminé la tarea siguiendo las specs y las buenas prácticas del proyecto"` (paja)
- `"Implementé el RPC register_profile.ts en src/rpcs/register_profile.ts"` (ya está en `files`, redundante)

---

## Buenas prácticas de game dev (obligatorias en este stack)

### Match handler autoritativo

- **Cero confianza en el cliente**: vida, daño, bloqueo, carga, tier — todo se calcula server-side. Cliente solo dice "quise golpear izquierda", servidor decide si conectó.
- **Tick rate 10 Hz**: broadcast solo **deltas** de estado, nunca el state completo. Costo de bandwidth y CPU importa.
- **Opcodes numéricos** (no strings). Nakama serializa mensajes; los numéricos son mucho más baratos.
- **State mínimo**: solo lo necesario para computar el próximo tick. Nada de logs, historia de golpes, etc. dentro del match state.
- **Determinismo**: dado mismo state + mismos inputs, mismo output. Facilita replays y anti-cheat.
- **Timing**: `Date.now()` server-side. Nunca confíes en timestamps del cliente.

### Client-server sync

- **Client-side prediction cosmético**: al presionar A, tu guante izquierdo se anima local instantáneo. Cuando llega la respuesta del servidor, si difiere → corrección silenciosa (snap, no animación del conflict).
- **Latency budget**: <100ms adicionales sobre RTT es aceptable; más se siente laggy.

### Balance y tuning

- **Todo parametrizado** en `src/data/*` o `src/config/*`. Nunca hardcodees HP, daño, XP curves, ventanas de telegraph en la lógica.
- **Playtest antes de tunear**: cambios de balance sin evidencia son adivinanza.
- **Documentá cada tuneo** en `docs/balance-notes.md`: antes / después / razón.

### Anti-cheat

- Validá **todo** input del cliente contra estado autoritativo.
- Rate-limit opcodes por sesión (ej. máx 10 punches/seg).
- Descartá silenciosamente inputs de players que no estén en `active` state.
- Nunca mandes el `rankScore` del oponente al cliente antes del match — solo bounds del matchmaker.

### Feel / juice

- Feedback inmediato al input local aunque el server aún no haya confirmado.
- Sound, shake, comic text = capas **independientes**, no bloqueantes entre sí.
- Cap absoluto en screen shake intensity + toggle "reduce motion" respetado (accesibilidad).
- Freeze frames en KO: máx 200ms, o rompe el ritmo.

### Runtime TS (Goja) — restricciones

- Target `es2020`. Goja **no** soporta ES2022+ (top-level await, class fields nuevos, etc.).
- Sin dependencias con **native bindings**. Solo JS puro que bundlee esbuild.
- Bundling a `build/index.js` single-file. No multi-módulo import a runtime.
- Log via `nk.logger.info/warn/error`, **nunca** `console.log`.
- Storage read/write: siempre wrappear en `try/catch`. Nakama lanza en not-found.
- No usar `Date` para calendarios (Goja tiene bugs con timezones raros); si necesitás fechas complejas, calculá en el cliente.

### UI cliente

- Mobile-first. Touch targets ≥ 44px.
- Contraste WCAG AA mínimo.
- Toggle "reduce motion" respetado en shake, animaciones agresivas, transiciones.
- Avatares cargan con `loading="lazy"`.
- Nunca bloquees UI en llamadas API — siempre loader visible.

### Testing

- **Funciones puras** (combat rules, Elo, XP, tier, username): **unit tests obligatorios**. Sin excepción.
- **RPCs**: integration tests contra Nakama en docker de test.
- **UI compleja**: al menos smoke test (renderea sin error).
- Tests corren antes del commit. Tests rojos → no hay merge.

### Git

- Conventional commits.
- Un commit = una task cerrada. Excepción: setup inicial multi-file.
- **Nunca** `--no-verify`. Los hooks están por algo.
- **Nunca** `Co-Authored-By` ni atribución de agente en mensaje.
- No mezclar refactor y feature en mismo commit.

### Documentación

- Si tu task introduce concepto no obvio (fórmula, protocolo custom, workaround), agregá comentario `// WHY: ...` en la línea correspondiente.
- **No** comentar el QUÉ (código bien nombrado ya lo dice), solo el POR QUÉ cuando no es evidente.
- No crees archivos `.md` nuevos salvo que la task lo pida explícitamente.

---

## Cosas que NO hacés

1. **No tocás tareas no asignadas a vos** sin dejar comment justificando la sustitución de modelo.
2. **No agregás dependencias npm** sin verificar compat con Goja runtime.
3. **No hardcodeás** API keys, URLs de producción, ni valores de balance.
4. **No borrás código de otros agentes** sin comment explicando por qué era incorrecto.
5. **No cambiás el schema de `tasks.json`** (agregar campo opcional OK, renombrar/cambiar tipos NO).
6. **No hacés commit con tests rojos** ni con errores de compilación.
7. **No claimes "done"** sin haber corrido/compilado/verificado el output real.
8. **No hacés refactors "de paso"** — cada refactor merece su propia task.
9. **No hacés generación de imagen client-side** — la API key de Replicate solo vive en el servidor Nakama.
10. **No confiés en timestamps del cliente** para lógica de gameplay.
11. **No dejás tasks en `in-progress`** al terminar tu turno. Cerrala como `done` o `blocked` — el `in-progress` huérfano rompe la detección de ready tasks.
12. **No terminás tu turno sin `git commit + git push`** con `docs/tasks.json` incluido. Task done sin push = task inexistente para el resto del equipo.
13. **No corrés `git add -A` / `git add .`** a ciegas cuando hay otro agente en paralelo. Agregá archivos por nombre para no tragar el trabajo ajeno.
14. **No hacés `git push --force`** a `main`. Si el push falla, `git pull --rebase` y volvé a pushear.
15. **No skipeás `node scripts/ale.mjs sync`** antes del commit. Dashboard desactualizado desorienta al resto.

---

## Handoff entre agentes

Cuando tu task termina, el siguiente agente arranca desde donde vos dejaste. Facilitale la vida:

- Comment claro con **archivos tocados** y **decisiones no obvias**.
- Si dejaste algo pendiente pero fuera de scope, mencionalo con sugerencia de task ID.
- Si tu task cambia una API pública (opcode, schema de storage, RPC input), notalo en el comment — el próximo agente puede estar consumiendo eso.
- Si notás que una task **downstream** tuya está desactualizada (deps cambió, spec cambió), dejá comment ahí también.

---

## Cuando tengas duda

1. Releé el PRD (`docs/PRD.md`) — casi todas las decisiones de diseño ya están ahí.
2. Releé la spec de la fase.
3. Buscá tasks vecinas y sus comments — otro agente puede haber resuelto lo mismo antes.
4. Si sigue sin quedar claro: marcá la task como `blocked` con comment explicando la duda concreta. **No adivines.**

---

## Ale — orquestrador (opcional pero recomendado)

En vez de elegir task a mano y decidir qué CLI usar, podés dejar que **Ale** lo haga. Ale lee `docs/tasks.json`, encuentra la próxima ready (`status=todo` + deps `done`), y spawnea el CLI correcto según el prefijo de `task.model`:

- `opencode/*` o `opencode-go/*` → `opencode run --auto -m <model>`
- `claude-*` u `opus|sonnet|haiku` → `claude -p --dangerously-skip-permissions --model <model>`

### Cómo se invoca

| Contexto | Comando |
|---|---|
| Terminal (alias shell) | `ale <sub> [flags]` — requiere alias en `~/.zshrc`: `alias ale="node $HOME/project/games/punch/scripts/ale.mjs"` |
| Terminal (sin alias) | `node scripts/ale.mjs <sub> [flags]` |
| Claude Code (slash-command) | `/ale <sub> [flags]` — usa `.claude/commands/ale.md` |

### Subcomandos

```
ale list                     # imprime tasks ready
ale list --json              # ídem, formato máquina
ale plan --next              # dry-run de la próxima (muestra prompt + comando spawn, no ejecuta)
ale plan --task T-045        # dry-run de una específica
ale run --next               # ejecuta la próxima ready
ale run --task T-045         # ejecuta específica
ale run --all                # loop hasta que no queden ready (para en el primer failure)
```

### Ciclo de una corrida

1. Ale toma un file-lock sobre `docs/tasks.json`, marca la task `in-progress`, libera lock.
2. Construye el prompt con `AGENTS.md` completo + la task en JSON + la spec de la fase + contrato de finalización.
3. Spawnea el CLI con `stdio: inherit` — vos ves el output en vivo.
4. Post-run: si el sub-agente no cambió `status` a `done|blocked`, Ale lo fuerza a `blocked` con comment `author: "ale"`.
5. Appendea entry al log `docs/ale-runs.jsonl`.

**Regla**: sos vos (o el sub-agente que Ale spawnee) quien actualiza `tasks.json`. Ale solo escribe la transición `todo → in-progress` al principio y el fallback `blocked` si el agente no cumplió el contrato. **No toques `tasks.json` mientras Ale está corriendo** — el lock evita corrupción pero no ediciones humanas concurrentes.

---

## Recursos externos

- [Nakama TS runtime docs](https://heroiclabs.com/docs/nakama/server-framework/typescript-runtime/)
- [Nakama match handler API](https://heroiclabs.com/docs/nakama/concepts/multiplayer/authoritative/)
- [Nakama matchmaker](https://heroiclabs.com/docs/nakama/concepts/matches/matchmaker/)
- [InstantID en Replicate](https://replicate.com/zsxkib/instant-id)
- [face-api.js](https://github.com/justadudewhohacks/face-api.js)

---

**Regla de oro**: si en cualquier momento sentís que estás improvisando, parás. Este proyecto tiene diseño hecho — tu valor es ejecutar bien, no reinventar.

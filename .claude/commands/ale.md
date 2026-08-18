---
description: Run Ale — the Punch Avatar task orchestrator (dispatches tasks to OpenCode/Claude based on tasks.json).
argument-hint: "<list|plan|run> [--task <id>|--next|--all] [--json]"
---

Run the Ale orchestrator with the arguments the user passed. Do NOT interpret, plan, or improvise — just execute the script and stream its output back.

Execute in the project root (`/Users/al3jandro/project/games/punch`):

```bash
node scripts/ale.mjs $ARGUMENTS
```

Rules:
- If `$ARGUMENTS` is empty, run `node scripts/ale.mjs --help`.
- Pass every flag through verbatim. Do not add, remove, or reorder flags.
- After the command finishes, if exit code is 0, say nothing — the script's output is enough.
- If exit code is non-zero, show the exit code and the last 5 lines of stderr, then stop. Do not try to "fix" the failure yourself.
- Never modify `docs/tasks.json`, `AGENTS.md`, or any spec directly — the orchestrator handles that.

Common invocations:
- `/ale list` — show ready tasks
- `/ale plan --next` — dry-run the next ready task
- `/ale run --next` — execute the next ready task
- `/ale run --task 12` — execute task by id
- `/ale run --all` — loop through ready tasks

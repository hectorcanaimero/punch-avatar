#!/usr/bin/env node
// Punch Avatar task orchestrator: reads docs/tasks.json and dispatches ready
// tasks to Claude Code or OpenCode based on the task's `model` field.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, openSync, closeSync, unlinkSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------- Configuration constants ----------

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TASKS_PATH = join(REPO_ROOT, "docs", "tasks.json");
const TASKS_LOCK = TASKS_PATH + ".lock";
const AGENTS_PATH = join(REPO_ROOT, "AGENTS.md");
const SPECS_DIR = join(REPO_ROOT, "docs", "specs");
const RUNS_LOG = join(REPO_ROOT, "docs", "ale-runs.jsonl");

const CLAUDE_BIN = "claude";
const OPENCODE_BIN = "opencode";

const LOCK_RETRIES = 20;
const LOCK_BACKOFF_MS = 100;

// Short-name → full Claude model id
const CLAUDE_SHORTNAMES = {
  opus: "claude-opus-4-7",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5",
};

// ---------- ANSI colors ----------

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};
const paint = (color, s) => `${color}${s}${C.reset}`;

// ---------- File I/O ----------

function readTextFile(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing required file: ${path}`);
  }
  return readFileSync(path, "utf8");
}

function readTasks() {
  const raw = readTextFile(TASKS_PATH);
  return { raw, data: JSON.parse(raw) };
}

function writeTasks(data) {
  // Preserve 2-space indent + trailing newline.
  const out = JSON.stringify(data, null, 2) + "\n";
  writeFileSync(TASKS_PATH, out, "utf8");
}

// ---------- Lock (concurrency safety) ----------

async function withLock(fn) {
  let fd = null;
  let attempts = 0;
  while (attempts < LOCK_RETRIES) {
    try {
      fd = openSync(TASKS_LOCK, "wx");
      break;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      attempts += 1;
      await new Promise((r) => setTimeout(r, LOCK_BACKOFF_MS));
    }
  }
  if (fd === null) {
    throw new Error(`Could not acquire lock on ${TASKS_LOCK} after ${LOCK_RETRIES} attempts. Delete the stale file if no other run is active.`);
  }
  try {
    return await fn();
  } finally {
    try { closeSync(fd); } catch {}
    try { unlinkSync(TASKS_LOCK); } catch {}
  }
}

// ---------- Task queries ----------

function findReady(data) {
  const doneIds = new Set(data.tasks.filter((t) => t.status === "done").map((t) => t.id));
  const ready = data.tasks.filter((t) => {
    if (t.status !== "todo") return false;
    const deps = t.dependencies || [];
    return deps.every((d) => doneIds.has(d));
  });
  // Numeric sort by id suffix (T-001 → 1).
  ready.sort((a, b) => taskIdNum(a.id) - taskIdNum(b.id));
  return ready;
}

function taskIdNum(id) {
  const m = String(id).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

function findTaskById(data, id) {
  return data.tasks.find((t) => t.id === id);
}

function findPhase(data, phaseId) {
  return (data.phases || []).find((p) => p.id === phaseId);
}

// ---------- Harness resolution ----------

function resolveHarness(model) {
  if (typeof model !== "string" || model.length === 0) {
    throw new Error(`Task has no model field`);
  }
  if (model.startsWith("opencode/") || model.startsWith("opencode-go/")) {
    return { harness: "opencode", model };
  }
  if (model.startsWith("claude-")) {
    return { harness: "claude", model };
  }
  if (CLAUDE_SHORTNAMES[model]) {
    return { harness: "claude", model: CLAUDE_SHORTNAMES[model] };
  }
  throw new Error(`Unknown model prefix: "${model}". Expected opencode/*, opencode-go/*, claude-*, or shortname (opus/sonnet/haiku).`);
}

function buildCommand(harness, resolvedModel, prompt) {
  if (harness === "opencode") {
    return {
      bin: OPENCODE_BIN,
      args: ["run", "--auto", "-m", resolvedModel, prompt],
    };
  }
  // claude
  return {
    bin: CLAUDE_BIN,
    args: [
      "-p",
      "--dangerously-skip-permissions",
      "--add-dir",
      REPO_ROOT,
      "--model",
      resolvedModel,
      prompt,
    ],
  };
}

// ---------- Prompt building ----------

function buildPrompt(task, data, agentsMd) {
  const phase = findPhase(data, task.phase);
  if (!phase) throw new Error(`Task ${task.id} references unknown phase ${task.phase}`);
  const specPath = join(SPECS_DIR, `${phase.spec}.md`);
  const specMd = readTextFile(specPath);

  return `Sos un agente ejecutor trabajando sobre el proyecto Punch Avatar.

## Reglas obligatorias
${agentsMd}

## Task a ejecutar
${JSON.stringify(task, null, 2)}

## Spec de la fase
${specMd}

## Contrato de finalización
1. Ejecutá la task siguiendo AGENTS.md al pie.
2. Cuando termines, actualizá docs/tasks.json:
   - Cambiá \`status\` de esta task a "done" (o "blocked" con razón).
   - Appendeá un comment al array \`comments\` con {author, text, ts}. \`author\` = "${task.model}". \`ts\` = ISO 8601 UTC.
3. NO toques otras tasks.
4. NO agregues archivos .md nuevos salvo que la task lo pida.
`;
}

// ---------- Shell quoting for display ----------

function shQuote(s) {
  if (s === "") return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s;
  return "'" + s.replace(/'/g, `'\\''`) + "'";
}

function displayCommand(cmd) {
  return [cmd.bin, ...cmd.args.map(shQuote)].join(" ");
}

// ---------- Commands ----------

function printHelp() {
  const usage = `${C.bold}Ale — Punch Avatar orchestrator${C.reset}

Usage:
  ${paint(C.cyan, "ale")} <command> [options]     ${paint(C.dim, "(alias / slash-command)")}
  ${paint(C.cyan, "node scripts/ale.mjs")} <command> [options]

Commands:
  list                          Print tasks that are ready (status=todo, deps done)
    --json                      Machine-readable output
  plan --task <id>              Show the resolved prompt + spawn command for one task (no exec)
  plan --next                   Same, for the next ready task
  run  --task <id>              Execute one task
  run  --next                   Execute the next ready task
  run  --all                    Loop over ready tasks; stop on first failure
  --help                        Show this help

Aliases:
  --dry-run                     Alias for the 'plan' command
`;
  process.stdout.write(usage);
}

function cmdList(opts) {
  const { data } = readTasks();
  const ready = findReady(data);
  if (opts.json) {
    process.stdout.write(JSON.stringify(ready, null, 2) + "\n");
    return;
  }
  if (ready.length === 0) {
    console.log(paint(C.yellow, "No ready tasks. Either all done, all in-progress/blocked, or deps unmet."));
    return;
  }
  console.log(paint(C.bold, `Ready tasks (${ready.length}):`));
  console.log(paint(C.dim, "─".repeat(100)));
  console.log(
    paint(C.dim, "ID".padEnd(8)) +
    paint(C.dim, "PHASE".padEnd(7)) +
    paint(C.dim, "STATUS".padEnd(12)) +
    paint(C.dim, "MODEL".padEnd(32)) +
    paint(C.dim, "TITLE")
  );
  console.log(paint(C.dim, "─".repeat(100)));
  for (const t of ready) {
    console.log(
      paint(C.green, String(t.id).padEnd(8)) +
      String(t.phase).padEnd(7) +
      paint(C.green, String(t.status).padEnd(12)) +
      paint(C.cyan, String(t.model).padEnd(32)) +
      t.title
    );
  }
}

function pickTaskForAction(data, opts) {
  if (opts.taskId) {
    const t = findTaskById(data, opts.taskId);
    if (!t) throw new Error(`Task not found: ${opts.taskId}`);
    return t;
  }
  if (opts.next) {
    const ready = findReady(data);
    if (ready.length === 0) throw new Error("No ready tasks available");
    return ready[0];
  }
  throw new Error("Specify --task <id> or --next");
}

function cmdPlan(opts) {
  const { data } = readTasks();
  const task = pickTaskForAction(data, opts);
  const agentsMd = readTextFile(AGENTS_PATH);
  const { harness, model } = resolveHarness(task.model);
  const prompt = buildPrompt(task, data, agentsMd);
  const cmd = buildCommand(harness, model, prompt);

  console.log(paint(C.bold, `Task ${task.id}`) + paint(C.dim, ` — phase ${task.phase} — status ${task.status}`));
  console.log(paint(C.cyan, `Model:   `) + task.model + paint(C.dim, ` (harness: ${harness}, resolved: ${model})`));
  console.log(paint(C.cyan, `Title:   `) + task.title);
  console.log(paint(C.cyan, `Files:   `) + (task.files || []).join(", "));
  console.log(paint(C.cyan, `Deps:    `) + ((task.dependencies || []).join(", ") || "(none)"));
  console.log();
  console.log(paint(C.bold, "Spawn command:"));
  console.log(paint(C.dim, displayCommand(cmd)));
  console.log();
  console.log(paint(C.bold, "Prompt:"));
  console.log(paint(C.dim, "```"));
  console.log(prompt);
  console.log(paint(C.dim, "```"));
  console.log();
  console.log(paint(C.yellow, "(dry-run — nothing executed)"));
}

async function markInProgress(taskId) {
  return withLock(async () => {
    const { data } = readTasks();
    const task = findTaskById(data, taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    // Re-verify readiness under lock.
    const doneIds = new Set(data.tasks.filter((t) => t.status === "done").map((t) => t.id));
    const deps = task.dependencies || [];
    if (task.status !== "todo") {
      throw new Error(`Task ${taskId} is no longer 'todo' (current: ${task.status})`);
    }
    if (!deps.every((d) => doneIds.has(d))) {
      throw new Error(`Task ${taskId} has unmet dependencies`);
    }
    task.status = "in-progress";
    writeTasks(data);
    return task;
  });
}

async function finalizeTaskStatus(taskId, exitCode) {
  return withLock(async () => {
    const { data } = readTasks();
    const task = findTaskById(data, taskId);
    if (!task) throw new Error(`Task vanished: ${taskId}`);
    const status = task.status;
    if (status === "done" || status === "blocked") {
      return { resultStatus: status, forcedBlock: false };
    }
    // Sub-agent didn't self-update. Force blocked with auto comment.
    task.status = "blocked";
    task.comments = Array.isArray(task.comments) ? task.comments : [];
    task.comments.push({
      author: "ale",
      text: `Agent did not self-update status. Exit code: ${exitCode}`,
      ts: new Date().toISOString(),
    });
    writeTasks(data);
    return { resultStatus: "blocked", forcedBlock: true };
  });
}

function appendRunLog(entry) {
  try {
    appendFileSync(RUNS_LOG, JSON.stringify(entry) + "\n", "utf8");
  } catch (err) {
    console.error(paint(C.red, `Warning: could not append to runs log: ${err.message}`));
  }
}

async function runTaskById(taskId) {
  const started = new Date();
  const task = await markInProgress(taskId);
  const { data } = readTasks();
  const agentsMd = readTextFile(AGENTS_PATH);
  const { harness, model } = resolveHarness(task.model);
  const prompt = buildPrompt(task, data, agentsMd);
  const cmd = buildCommand(harness, model, prompt);

  console.log(paint(C.bold + C.green, `▶ Running task ${task.id} with ${task.model}`));
  console.log(paint(C.dim, `  harness=${harness} model=${model}`));
  console.log(paint(C.dim, `  ${displayCommand({ bin: cmd.bin, args: cmd.args.slice(0, -1).concat(["<prompt>"]) })}`));
  console.log();

  let exitCode = 1;
  let spawnError = null;
  try {
    const result = spawnSync(cmd.bin, cmd.args, {
      stdio: "inherit",
      cwd: REPO_ROOT,
    });
    if (result.error) {
      spawnError = result.error;
      if (result.error.code === "ENOENT") {
        console.error(paint(C.red, `\n✗ CLI not found: ${cmd.bin}. Install it or check PATH.`));
        if (harness === "claude") {
          console.error(paint(C.dim, `  Expected at /opt/homebrew/bin/claude — run: brew install claude-code`));
        } else {
          console.error(paint(C.dim, `  Expected at ~/.opencode/bin/opencode — see https://opencode.ai/docs/`));
        }
      } else {
        console.error(paint(C.red, `\n✗ Spawn error: ${result.error.message}`));
      }
      exitCode = -1;
    } else {
      exitCode = result.status == null ? -1 : result.status;
    }
  } catch (err) {
    spawnError = err;
    console.error(paint(C.red, `\n✗ Unexpected error: ${err.message}`));
  }

  const ended = new Date();
  const durationMs = ended.getTime() - started.getTime();
  const { resultStatus, forcedBlock } = await finalizeTaskStatus(task.id, exitCode);

  appendRunLog({
    taskId: task.id,
    model: task.model,
    harness,
    exitCode,
    startedAt: started.toISOString(),
    endedAt: ended.toISOString(),
    durationMs,
    resultStatus,
  });

  const durSec = (durationMs / 1000).toFixed(1);
  if (resultStatus === "done") {
    console.log(paint(C.green + C.bold, `\n✓ ${task.id} done in ${durSec}s`));
  } else {
    console.log(paint(C.yellow + C.bold, `\n✗ ${task.id} blocked` + (forcedBlock ? " (forced by ale)" : "") + ` after ${durSec}s`));
  }
  return { exitCode, resultStatus, spawnError };
}

async function cmdRun(opts) {
  if (opts.all) {
    let loop = 0;
    while (true) {
      loop += 1;
      const { data } = readTasks();
      const ready = findReady(data);
      if (ready.length === 0) {
        console.log(paint(C.green + C.bold, `\n✓ No more ready tasks. Loop finished after ${loop - 1} run(s).`));
        return;
      }
      const next = ready[0];
      console.log(paint(C.magenta + C.bold, `\n═══ Iteration ${loop}: ${next.id} ═══`));
      const { resultStatus, spawnError } = await runTaskById(next.id);
      if (spawnError || resultStatus !== "done") {
        console.log(paint(C.red + C.bold, `\n✗ Stopping --all loop on failure of ${next.id}.`));
        process.exitCode = 1;
        return;
      }
    }
  }
  const { data } = readTasks();
  const task = pickTaskForAction(data, opts);
  const { spawnError, resultStatus } = await runTaskById(task.id);
  if (spawnError || resultStatus !== "done") process.exitCode = 1;
}

// ---------- Argv parsing ----------

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { command: null, taskId: null, next: false, all: false, json: false };

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    opts.command = "help";
    return opts;
  }

  const first = args[0];
  if (first === "list" || first === "plan" || first === "run") {
    opts.command = first;
  } else if (first === "--dry-run") {
    opts.command = "plan";
  } else {
    throw new Error(`Unknown command: ${first}. Try --help.`);
  }

  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === "--task") {
      opts.taskId = args[++i];
      if (!opts.taskId) throw new Error("--task requires a value");
    } else if (a === "--next") {
      opts.next = true;
    } else if (a === "--all") {
      opts.all = true;
    } else if (a === "--json") {
      opts.json = true;
    } else if (a === "--help" || a === "-h") {
      opts.command = "help";
      return opts;
    } else {
      throw new Error(`Unknown flag: ${a}`);
    }
  }
  return opts;
}

// ---------- Main ----------

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv);
  } catch (err) {
    console.error(paint(C.red, `Error: ${err.message}`));
    process.exit(2);
  }

  try {
    switch (opts.command) {
      case "help":
        printHelp();
        return;
      case "list":
        cmdList(opts);
        return;
      case "plan":
        cmdPlan(opts);
        return;
      case "run":
        await cmdRun(opts);
        return;
    }
  } catch (err) {
    console.error(paint(C.red, `\n✗ ${err.message}`));
    process.exit(1);
  }
}

main();

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdir, readFile, stat, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Local Piper TTS install — update PIPER_DIR (or set the env var) if it moves.
const PIPER_DIR = process.env.PIPER_DIR || "C:\\piper";
const PIPER_EXE = path.join(PIPER_DIR, "piper.exe");
const PIPER_MODEL = path.join(PIPER_DIR, "de_DE-thorsten-high.onnx");
const PIPER_OUTPUT_DIR = path.join(os.tmpdir(), "piper-output");

// --- Tunables ---
const MAX_PENDING = 10; // backstop against an unbounded queue if the process is wedged
const STABLE_POLL_INTERVAL_MS = 25; // how often to check whether an output file has stopped growing
const STABLE_POLL_TIMEOUT_MS = 15000; // give up waiting for a file to finish writing after this long
const WRITE_TIMEOUT_MS = 15000; // give up waiting for Piper to acknowledge a request after this long
const RESPAWN_COOLDOWN_MS = 2000; // avoid crash-looping respawns if Piper is fundamentally broken

// Cached on globalThis so a Next.js dev (Turbopack) module reload doesn't leak a duplicate
// piper.exe process — plain module-scope state gets reset on every hot-reload, globalThis doesn't.
let piperState = globalThis.__piperState;
if (!piperState) {
  piperState = globalThis.__piperState = {
    child: null,
    pending: [], // FIFO queue of { resolve, reject }, one entry per in-flight request
    lastCrashTime: 0,
  };
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function rejectAllPending(err) {
  const stillPending = piperState.pending.splice(0);
  for (const entry of stillPending) entry.reject(err);
}

function spawnPiper() {
  const child = spawn(PIPER_EXE, ["-m", PIPER_MODEL, "--json-input", "-d", PIPER_OUTPUT_DIR], {
    cwd: PIPER_DIR,
  });

  const rl = createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    const entry = piperState.pending.shift();
    if (entry) entry.resolve(line.trim());
  });

  child.on("exit", (code) => {
    console.error(`[speak] Piper process exited unexpectedly (code ${code}); will respawn on next request.`);
    piperState.child = null;
    piperState.lastCrashTime = Date.now();
    rejectAllPending(new Error(`Piper process exited unexpectedly (code ${code})`));
  });

  child.on("error", (err) => {
    console.error(`[speak] Piper process error: ${err.message}`);
    piperState.child = null;
    piperState.lastCrashTime = Date.now();
    rejectAllPending(err);
  });

  return child;
}

async function getPiperProcess() {
  if (piperState.child) return piperState.child;

  if (Date.now() - piperState.lastCrashTime < RESPAWN_COOLDOWN_MS) {
    throw new Error("Piper recently crashed; cooling down before respawning.");
  }

  await mkdir(PIPER_OUTPUT_DIR, { recursive: true });
  piperState.child = spawnPiper();
  return piperState.child;
}

// Piper announces an output file's path on stdout as soon as it starts on that line, well
// before synthesis finishes writing it — confirmed by polling a file mid-synthesis and
// seeing it sit at 0 bytes while still in progress. So "file exists" or "path was announced"
// is not a safe read signal; wait for its size to stop changing between two checks instead.
async function waitForStableFile(filePath) {
  const start = Date.now();
  let lastSize = -1;
  while (Date.now() - start < STABLE_POLL_TIMEOUT_MS) {
    let size = -1;
    try {
      size = (await stat(filePath)).size;
    } catch {
      // not created yet
    }
    if (size > 0 && size === lastSize) return;
    lastSize = size;
    await new Promise((resolve) => setTimeout(resolve, STABLE_POLL_INTERVAL_MS));
  }
  throw new Error(`Timed out waiting for Piper output file to finish writing: ${filePath}`);
}

export async function synthesize(text) {
  if (piperState.pending.length >= MAX_PENDING) {
    throw new Error("Piper request queue is full; try again shortly.");
  }

  const child = await getPiperProcess();

  const filePath = await withTimeout(
    new Promise((resolve, reject) => {
      // Push before writing, with no await in between, so this request's resolver is
      // queued in the same order its line is sent — keeps the FIFO matching correct.
      const entry = { resolve, reject };
      piperState.pending.push(entry);
      child.stdin.write(`${JSON.stringify({ text })}\n`, (err) => {
        if (!err) return;
        const idx = piperState.pending.indexOf(entry);
        if (idx !== -1) piperState.pending.splice(idx, 1);
        reject(err);
      });
    }),
    WRITE_TIMEOUT_MS,
    "Timed out waiting for Piper to accept the request."
  );

  try {
    await waitForStableFile(filePath);
    return await readFile(filePath);
  } finally {
    await unlink(filePath).catch(() => {});
  }
}

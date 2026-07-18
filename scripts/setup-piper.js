"use strict";

// Fetches the Linux Piper TTS binary and German voice model at build time (Render's free
// tier has an ephemeral filesystem, so nothing can be placed there manually). No-ops on
// Windows, where Piper is installed manually per README.md at C:\piper.

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");

const IS_WINDOWS = process.platform === "win32";

// Mirrors getTtsMode() in lib/env.js — kept separate since this script runs outside
// Next.js's module system (plain Node, invoked via postinstall).
const TTS_MODE =
  process.env.TTS_MODE === "piper" || process.env.TTS_MODE === "browser"
    ? process.env.TTS_MODE
    : process.env.VERCEL
      ? "browser"
      : "piper";

const PIPER_DIR =
  process.env.PIPER_DIR || (IS_WINDOWS ? "C:\\piper" : path.join(process.cwd(), "vendor", "piper"));

const PIPER_TARBALL_URL =
  "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz";
const MODEL_URL =
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx";
const MODEL_CONFIG_URL = `${MODEL_URL}.json`;
const MIN_MODEL_BYTES = 100 * 1024 * 1024; // guards against a truncated/corrupt prior download

const piperBin = () => path.join(PIPER_DIR, "piper");
const modelFile = () => path.join(PIPER_DIR, "de_DE-thorsten-high.onnx");
const modelConfigFile = () => `${modelFile()}.json`;

function alreadyInstalled() {
  if (!fs.existsSync(piperBin()) || !fs.existsSync(modelConfigFile())) return false;
  return fs.existsSync(modelFile()) && fs.statSync(modelFile()).size >= MIN_MODEL_BYTES;
}

async function downloadTo(url, destPath) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`download failed (${res.status} ${res.statusText}): ${url}`);
  }
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(destPath));
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

async function main() {
  if (IS_WINDOWS) {
    console.log("[setup-piper] Windows detected — skipping Piper download; using local install.");
    return;
  }

  if (TTS_MODE !== "piper") {
    console.log(
      `[setup-piper] TTS mode is "${TTS_MODE}" — skipping Piper download (it would never be used).`
    );
    return;
  }

  if (alreadyInstalled()) {
    console.log(`[setup-piper] Piper already present at ${PIPER_DIR}, skipping.`);
    return;
  }

  console.log(`[setup-piper] Setting up Piper TTS at ${PIPER_DIR}...`);
  await fsp.mkdir(PIPER_DIR, { recursive: true });

  const tarballPath = path.join(os.tmpdir(), `piper-linux-${Date.now()}.tar.gz`);
  try {
    console.log(`[setup-piper] Downloading Piper binary from ${PIPER_TARBALL_URL}...`);
    await downloadTo(PIPER_TARBALL_URL, tarballPath);
    console.log(`[setup-piper] Downloaded binary (${mb(fs.statSync(tarballPath).size)}).`);

    console.log("[setup-piper] Extracting...");
    execFileSync("tar", ["-xzf", tarballPath, "-C", PIPER_DIR, "--strip-components=1"]);

    console.log(`[setup-piper] Downloading voice model from ${MODEL_URL}...`);
    await downloadTo(MODEL_URL, modelFile());
    await downloadTo(MODEL_CONFIG_URL, modelConfigFile());
    console.log(`[setup-piper] Downloaded voice model (${mb(fs.statSync(modelFile()).size)}).`);

    fs.chmodSync(piperBin(), 0o755);

    console.log(`[setup-piper] Piper TTS ready at ${PIPER_DIR}.`);
  } finally {
    await fsp.rm(tarballPath, { force: true });
  }
}

main().catch((err) => {
  console.error(`[setup-piper] Setup failed: ${err.message}`);
  process.exit(1);
});

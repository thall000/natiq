import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

export function getGroqApiKey() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to .env.local — see README.md for setup instructions."
    );
  }
  return key;
}

// Selects the DEV Turso database in development and the PROD database in production
// (Render's free tier doesn't persist local files, so both environments talk to Turso).
function tursoEnvPrefix() {
  return process.env.NODE_ENV === "production" ? "TURSO_PROD" : "TURSO_DEV";
}

export function getTursoCredentials() {
  const prefix = tursoEnvPrefix();
  const url = process.env[`${prefix}_DATABASE_URL`];
  const authToken = process.env[`${prefix}_AUTH_TOKEN`];
  if (!url || !authToken) {
    throw new Error(
      `${prefix}_DATABASE_URL / ${prefix}_AUTH_TOKEN is not set. Add it to .env.local — see README.md for setup instructions.`
    );
  }
  return { url, authToken };
}

// Mirrors the path resolution in app/api/speak/piperClient.js — kept separate since that
// file needs it at import time and this one is only for the startup warning below.
export function checkPiperInstall() {
  const isWindows = process.platform === "win32";
  const piperDir =
    process.env.PIPER_DIR || (isWindows ? "C:\\piper" : path.join(process.cwd(), "vendor", "piper"));
  const piperExe = path.join(piperDir, isWindows ? "piper.exe" : "piper");
  const model = path.join(piperDir, "de_DE-thorsten-high.onnx");

  if (!existsSync(piperExe) || !existsSync(model)) {
    return `Piper TTS files not found at ${piperDir} — /live conversations will fail until this is fixed. See README.md.`;
  }
  return null;
}

// Piper's persistent child-process architecture can't run on serverless platforms (each
// request may hit a different, short-lived instance). Vercel sets VERCEL=1 automatically in
// both build and runtime — unlike NODE_ENV, which is "production" on Render too, this is
// the one signal that actually distinguishes "serverless, no persistent process" from
// "persistent server, Piper works fine". TTS_MODE lets either be forced explicitly.
export function getTtsMode() {
  const explicit = process.env.TTS_MODE;
  if (explicit === "piper" || explicit === "browser") return explicit;
  return process.env.VERCEL ? "browser" : "piper";
}

export function checkRequiredEnvVars() {
  const missing = [];
  if (!process.env.GROQ_API_KEY) missing.push("GROQ_API_KEY");
  if (!process.env.AUTH_SECRET) missing.push("AUTH_SECRET");
  const prefix = tursoEnvPrefix();
  if (!process.env[`${prefix}_DATABASE_URL`]) missing.push(`${prefix}_DATABASE_URL`);
  if (!process.env[`${prefix}_AUTH_TOKEN`]) missing.push(`${prefix}_AUTH_TOKEN`);
  return missing;
}

import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

// Cached on globalThis, same reasoning as app/api/speak/piperClient.js: a Next.js dev
// (Turbopack) module reload must not open a second connection to the same file.
const DATA_DIR = path.join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });

let db = globalThis.__natiqDb;
if (!db) {
  db = globalThis.__natiqDb = new Database(path.join(DATA_DIR, "natiq.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS practice_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      category TEXT NOT NULL,
      questions_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversation_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      category TEXT NOT NULL,
      scenario_title TEXT NOT NULL,
      scenario_prompt TEXT NOT NULL,
      score INTEGER,
      feedback_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

export function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function createUser(email, passwordHash) {
  const info = db
    .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
    .run(email, passwordHash);
  return info.lastInsertRowid;
}

export function savePracticeSession(userId, category, questions) {
  db.prepare(
    "INSERT INTO practice_sessions (user_id, category, questions_json) VALUES (?, ?, ?)"
  ).run(userId, category, JSON.stringify(questions));
}

export function saveConversationResult(userId, { category, scenarioTitle, scenarioPrompt, score, feedback }) {
  db.prepare(
    `INSERT INTO conversation_results
      (user_id, category, scenario_title, scenario_prompt, score, feedback_json)
      VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, category, scenarioTitle, scenarioPrompt, score ?? null, JSON.stringify(feedback));
}

export function getPracticeSessionsForUser(userId) {
  return db
    .prepare("SELECT * FROM practice_sessions WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId)
    .map((row) => ({ ...row, questions: JSON.parse(row.questions_json) }));
}

export function getConversationResultsForUser(userId) {
  return db
    .prepare("SELECT * FROM conversation_results WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId)
    .map((row) => ({ ...row, feedback: JSON.parse(row.feedback_json) }));
}

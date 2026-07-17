import "server-only";
import { createClient } from "@libsql/client";
import { getTursoCredentials } from "./env";

// Cached on globalThis, same reasoning as app/api/speak/piperClient.js: a Next.js dev
// (Turbopack) module reload must not open a second connection to the same database.
let client = globalThis.__natiqDb;
let schemaReady = globalThis.__natiqDbSchemaReady;

if (!client) {
  const { url, authToken } = getTursoCredentials();
  client = globalThis.__natiqDb = createClient({ url, authToken });
  schemaReady = globalThis.__natiqDbSchemaReady = client.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS practice_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        category TEXT NOT NULL,
        questions_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS conversation_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        category TEXT NOT NULL,
        scenario_title TEXT NOT NULL,
        scenario_prompt TEXT NOT NULL,
        score INTEGER,
        feedback_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ],
    "write"
  );
}

function rowToObject(columns, row) {
  const obj = {};
  columns.forEach((col, i) => {
    obj[col] = row[i];
  });
  return obj;
}

export async function getUserByEmail(email) {
  await schemaReady;
  const rs = await client.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
  return rs.rows[0] ? rowToObject(rs.columns, rs.rows[0]) : undefined;
}

export async function getUserById(id) {
  await schemaReady;
  const rs = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
  return rs.rows[0] ? rowToObject(rs.columns, rs.rows[0]) : undefined;
}

export async function createUser(email, passwordHash) {
  await schemaReady;
  const rs = await client.execute({
    sql: "INSERT INTO users (email, password_hash) VALUES (?, ?)",
    args: [email, passwordHash],
  });
  return rs.lastInsertRowid;
}

export async function savePracticeSession(userId, category, questions) {
  await schemaReady;
  await client.execute({
    sql: "INSERT INTO practice_sessions (user_id, category, questions_json) VALUES (?, ?, ?)",
    args: [userId, category, JSON.stringify(questions)],
  });
}

export async function saveConversationResult(userId, { category, scenarioTitle, scenarioPrompt, score, feedback }) {
  await schemaReady;
  await client.execute({
    sql: `INSERT INTO conversation_results
      (user_id, category, scenario_title, scenario_prompt, score, feedback_json)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [userId, category, scenarioTitle, scenarioPrompt, score ?? null, JSON.stringify(feedback)],
  });
}

export async function getPracticeSessionsForUser(userId) {
  await schemaReady;
  const rs = await client.execute({
    sql: "SELECT * FROM practice_sessions WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
  return rs.rows.map((row) => {
    const obj = rowToObject(rs.columns, row);
    return { ...obj, questions: JSON.parse(obj.questions_json) };
  });
}

export async function getConversationResultsForUser(userId) {
  await schemaReady;
  const rs = await client.execute({
    sql: "SELECT * FROM conversation_results WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
  return rs.rows.map((row) => {
    const obj = rowToObject(rs.columns, row);
    return { ...obj, feedback: JSON.parse(obj.feedback_json) };
  });
}

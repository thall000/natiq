import "server-only";

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

export function checkRequiredEnvVars() {
  const missing = [];
  if (!process.env.GROQ_API_KEY) missing.push("GROQ_API_KEY");
  if (!process.env.AUTH_SECRET) missing.push("AUTH_SECRET");
  const prefix = tursoEnvPrefix();
  if (!process.env[`${prefix}_DATABASE_URL`]) missing.push(`${prefix}_DATABASE_URL`);
  if (!process.env[`${prefix}_AUTH_TOKEN`]) missing.push(`${prefix}_AUTH_TOKEN`);
  return missing;
}

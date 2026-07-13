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

export function checkRequiredEnvVars() {
  const missing = [];
  if (!process.env.GROQ_API_KEY) missing.push("GROQ_API_KEY");
  if (!process.env.AUTH_SECRET) missing.push("AUTH_SECRET");
  return missing;
}

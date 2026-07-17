export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { checkRequiredEnvVars } = await import("./lib/env");
  const missing = checkRequiredEnvVars();

  if (missing.length > 0) {
    console.error(
      `\n[Natiq] Missing required environment variable(s): ${missing.join(", ")}.\n` +
        "Add them to .env.local before starting the server — see README.md for setup instructions.\n" +
        (missing.includes("GROQ_API_KEY")
          ? "Without GROQ_API_KEY, transcription, feedback, and the live conversation feature will fail.\n"
          : "") +
        (missing.includes("AUTH_SECRET")
          ? "Without AUTH_SECRET, sign-in/sign-up will fail.\n"
          : "") +
        (missing.some((v) => v.startsWith("TURSO_"))
          ? "Without the TURSO_* database credentials, accounts and saved progress will fail.\n"
          : "")
    );
  }
}

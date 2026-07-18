import { getTtsMode } from "../../../lib/env";

export const maxDuration = 30;

export async function POST(request) {
  if (getTtsMode() !== "piper") {
    return Response.json(
      {
        error: "Piper TTS is not available in this deployment.",
        details: "TTS_MODE resolved to \"browser\" — the client should use window.speechSynthesis instead of calling this route.",
      },
      { status: 501 }
    );
  }

  // Imported lazily, only once Piper is confirmed to be the active mode, so this route
  // never tries to spawn a process on a platform (e.g. Vercel serverless) where it can't.
  const { synthesize } = await import("./piperClient");

  const { text } = await request.json();

  try {
    const audioBuffer = await synthesize(text);
    return new Response(audioBuffer, {
      headers: { "Content-Type": "audio/wav" },
    });
  } catch (err) {
    console.error(`[speak] Piper synthesis failed: ${err.message}`);
    return Response.json(
      { error: "Speech synthesis failed", details: err.message },
      { status: 502 }
    );
  }
}

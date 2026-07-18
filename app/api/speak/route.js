import { getTtsMode } from "../../../lib/env";

export const maxDuration = 30;

export async function POST(request) {
  const ttsMode = getTtsMode();
  if (ttsMode !== "piper" && ttsMode !== "edge") {
    return Response.json(
      {
        error: "Server-side TTS is not available in this deployment.",
        details: "TTS_MODE resolved to \"browser\" — the client should use window.speechSynthesis instead of calling this route.",
      },
      { status: 501 }
    );
  }

  const { text } = await request.json();

  // Imported lazily, only for the mode actually in use, so a Vercel deployment never
  // touches piperClient.js's process-spawning code, and vice versa.
  try {
    if (ttsMode === "edge") {
      const { synthesize } = await import("./edgeTtsClient");
      const audioBuffer = await synthesize(text);
      return new Response(audioBuffer, { headers: { "Content-Type": "audio/mpeg" } });
    }

    const { synthesize } = await import("./piperClient");
    const audioBuffer = await synthesize(text);
    return new Response(audioBuffer, { headers: { "Content-Type": "audio/wav" } });
  } catch (err) {
    console.error(`[speak] ${ttsMode} synthesis failed: ${err.message}`);
    return Response.json(
      { error: "Speech synthesis failed", details: err.message },
      { status: 502 }
    );
  }
}

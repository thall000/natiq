import { synthesize } from "./piperClient";

export const maxDuration = 30;

export async function POST(request) {
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

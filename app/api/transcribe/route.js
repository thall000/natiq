export const maxDuration = 30;

// Bias transcription toward domain vocabulary that Whisper otherwise frequently
// mis-transcribes (e.g. "Kundenberater" coming out differently every time).
const VOCABULARY_PROMPT =
  "Vorstellungsgespräch und Kundenservice-Rollenspiel für eine Stelle als Kundenberater. " +
  "Themen: Kündigung, Rechnung, Tarif, Reklamation, Rückerstattung, Ersatzlieferung, " +
  "Buchung, Stornierung, Reservierung, Mietwagen, Kaution, Vollkasko.";

export async function POST(request) {
  const formData = await request.formData();
  const audio = formData.get("audio");

  const upstreamForm = new FormData();
  upstreamForm.append("file", audio, "recording.webm");
  upstreamForm.append("model", "whisper-large-v3");
  upstreamForm.append("language", "de");
  upstreamForm.append("prompt", VOCABULARY_PROMPT);

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: upstreamForm,
  });

  if (!res.ok) {
    const errorText = await res.text();
    return Response.json(
      { error: "Transcription failed", details: errorText },
      { status: 502 }
    );
  }

  const data = await res.json();
  return Response.json({ transcript: data.text });
}

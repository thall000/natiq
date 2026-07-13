// Drives the AI's side of the "Live-Gespräch üben" roleplay: it plays the customer
// persona described in the scenario, one short line at a time, reacting to the
// trainee's transcribed replies so far.

import { getGroqApiKey } from "../../../lib/env";

function buildSystemPrompt(scenarioPrompt) {
  return (
    "Du spielst in einem Rollenspiel die Rolle eines Kunden/einer Kundin in einem deutschsprachigen Kundenservice-Gespräch. " +
    "Die folgende Szenario-Beschreibung wurde ursprünglich als Übungsanleitung für einen Kundenservice-Mitarbeiter geschrieben:\n\n" +
    `"${scenarioPrompt}"\n\n` +
    "Ziehe daraus NUR die Situation und die Persönlichkeit/Stimmung des Kunden heraus (wer er ist, was das Problem ist, wie er sich fühlt, " +
    "z. B. genervt, in Eile, verärgert, misstrauisch). Ignoriere alle Sätze darin, die eigentlich Anweisungen an den Mitarbeiter sind " +
    '(z. B. "Beruhigen Sie den Kunden", "entschuldigen Sie sich") — das ist nicht deine Rolle.\n\n' +
    "Du bist ausschließlich der Kunde, niemals der Mitarbeiter, und niemals eine KI. Bleibe während des gesamten Gesprächs konsequent " +
    "in dieser Rolle. Sprich natürliches, gesprochenes Deutsch, wie am Telefon oder am Schalter — keine Listen, keine Aufzählungen, " +
    "keine Erklärungen außerhalb der Rolle. Halte jede Antwort SEHR kurz: höchstens 1-2 Sätze, wie eine echte Gesprächsäußerung am " +
    "Telefon. Kein Monolog, keine langen Ausführungen — sag jeweils nur, was in diesem einen Moment des Gesprächs natürlich wäre, " +
    "und lass Raum für die Antwort des Mitarbeiters.\n\n" +
    "Wenn das Gespräch gerade erst beginnt, eröffne es selbst, so wie es zur Szenario-Beschreibung passt (z. B. als Anruf oder als " +
    "Ansprache am Schalter). Reagiere sonst natürlich auf das, was der Mitarbeiter zuletzt gesagt hat, und entwickle das Gespräch " +
    "glaubwürdig weiter."
  );
}

export async function POST(request) {
  let groqApiKey;
  try {
    groqApiKey = getGroqApiKey();
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  const { scenarioPrompt, messages } = await request.json();

  const history =
    messages.length > 0
      ? messages
      : [{ role: "user", content: "(Das Gespräch beginnt jetzt. Bitte eröffne es als der Kunde.)" }];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 120,
      messages: [{ role: "system", content: buildSystemPrompt(scenarioPrompt) }, ...history],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    return Response.json(
      { error: "Conversation turn failed", details: errorText },
      { status: 502 }
    );
  }

  const data = await res.json();
  const line = data.choices[0].message.content.trim();

  return Response.json({ line });
}

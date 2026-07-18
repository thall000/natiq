// Drives the AI's side of the "Live-Gespräch üben" roleplay: it plays the customer
// persona described in the scenario, one short line at a time, reacting to the
// trainee's transcribed replies so far.

import { getGroqApiKey, getGroqConversationModel } from "../../../lib/env";
import { parseGroqError } from "../../../lib/groq";

// Conversation history grows every turn but Groq bills/rate-limits per request on the
// FULL messages array sent each time — without a cap, a long conversation resends its
// entire transcript on every single turn. Only the customer's last couple of exchanges
// are ever relevant to "what should they say next", so the older half of a long
// conversation is dead weight tokens-wise. Counts individual messages (not exchanges),
// so this keeps roughly the last 3 back-and-forth pairs.
const MAX_HISTORY_MESSAGES = 6;

// Customer lines are one short spoken sentence or two — this is a generous ceiling for
// that, not a target length (the system prompt already asks for 1-2 sentences).
const MAX_REPLY_TOKENS = 120;

function buildSystemPrompt(scenarioPrompt) {
  return (
    "Du spielst in einem Rollenspiel ausschließlich die Rolle eines Kunden/einer Kundin in einem " +
    "deutschsprachigen Kundenservice-Gespräch — niemals der Mitarbeiter, niemals eine KI, während " +
    "des gesamten Gesprächs.\n\n" +
    "Die folgende Szenario-Beschreibung wurde ursprünglich als Übungsanleitung für einen Kundenservice-Mitarbeiter geschrieben:\n\n" +
    `"${scenarioPrompt}"\n\n` +
    "Ziehe daraus NUR die Situation und die Persönlichkeit/Stimmung des Kunden heraus (wer er ist, was das Problem ist, wie er sich fühlt, " +
    "z. B. genervt, in Eile, verärgert, misstrauisch). Ignoriere Anweisungen darin an den Mitarbeiter " +
    '(z. B. "Beruhigen Sie den Kunden") — das ist nicht deine Rolle.\n\n' +
    "Sprich natürliches, gesprochenes Deutsch wie am Telefon oder am Schalter: keine Listen, keine Erklärungen außerhalb der Rolle, " +
    "kein Monolog. Höchstens 1-2 kurze Sätze pro Antwort — nur, was in diesem einen Moment natürlich wäre, mit Raum für die Antwort " +
    "des Mitarbeiters.\n\n" +
    "Wenn das Gespräch gerade erst beginnt, eröffne es selbst passend zur Szenario-Beschreibung (z. B. als Anruf oder am Schalter). " +
    "Reagiere sonst auf die letzte Äußerung des Mitarbeiters und entwickle das Gespräch glaubwürdig weiter."
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

  const fullHistory =
    messages.length > 0
      ? messages
      : [{ role: "user", content: "(Das Gespräch beginnt jetzt. Bitte eröffne es als der Kunde.)" }];
  const history = fullHistory.slice(-MAX_HISTORY_MESSAGES);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getGroqConversationModel(),
      max_tokens: MAX_REPLY_TOKENS,
      messages: [{ role: "system", content: buildSystemPrompt(scenarioPrompt) }, ...history],
    }),
  });

  if (!res.ok) {
    const groqError = await parseGroqError(res);
    if (groqError.isRateLimited) {
      return Response.json(
        { error: "rate_limited", retryAfterSeconds: groqError.retryAfterSeconds },
        { status: 429 }
      );
    }
    return Response.json(
      { error: "Conversation turn failed", details: groqError.rawText },
      { status: 502 }
    );
  }

  const data = await res.json();
  const line = data.choices[0].message.content.trim();

  return Response.json({ line });
}

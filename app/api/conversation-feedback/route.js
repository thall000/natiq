// Evaluates a full "Live-Gespräch üben" transcript at once, once the trainee ends the
// conversation. Separate from app/api/feedback/route.js (which grades a single answer)
// so that route stays untouched, but reuses the same rubric/JSON schema.
//
// TEMPORARY: using Groq's free-tier Llama 3.3 here too, for the same reason as
// app/api/feedback/route.js — avoiding Anthropic API costs while testing/designing.
// Swapping back to Claude for better feedback quality later is an isolated change,
// just this fetch call.

import { getGroqApiKey, getGroqFeedbackModel } from "../../../lib/env";
import { parseGroqError } from "../../../lib/groq";

// The JSON schema below (score + assessment + up to a handful of grammar/phrasing
// items + contentIdeas + modelAnswer) realistically runs a few hundred tokens; this
// leaves comfortable headroom without leaving the door open to a runaway response.
const MAX_FEEDBACK_TOKENS = 900;

const SYSTEM_PROMPT =
  "Du bist ein einfühlsamer Sprechtrainer für Bewerber, die sich auf deutschsprachige Kundenservice-Interviews (BPO) vorbereiten. " +
  "Du bekommst das Transkript eines geübten Rollenspiel-Gesprächs: „Kunde\" ist eine KI-gespielte Kundenpersona, „Sie\" ist die " +
  "Person, die du bewertest (der Kundenservice-Mitarbeiter in Ausbildung). Bewerte AUSSCHLIESSLICH die Zeilen von „Sie\", nicht die " +
  "der Kundenpersona.\n\n" +
  "Du gibst deine Rückmeldung als JSON-Objekt mit genau diesen sieben Feldern zurück:\n" +
  '"score" (integer 1-10), "scoreJustification" (string), "assessment" (string), ' +
  '"grammarMistakes" (Array von { "original", "corrected" }), ' +
  '"naturalPhrasing" (Array von { "original", "suggestion", "reason" }), ' +
  '"contentIdeas" (Array von Strings), "modelAnswer" (string).\n\n' +
  "Inhalt der Felder:\n" +
  "1. score und scoreJustification: Eine Gesamtnote von 1 bis 10 für die Leistung von „Sie\" über das GESAMTE Gespräch, plus " +
  "eine sehr kurze Begründung (GENAU EIN Satz, z. B. \"Klar und selbstbewusst, aber ein paar wiederkehrende Wortstellungsfehler.\" " +
  "— ohne die Note selbst nochmal im Satz zu wiederholen). Gewichte die Note wie bei einem Vorstellungsgespräch, NICHT wie bei " +
  "einer Grammatikprüfung: Klarheit/Tempo und Selbstbewusstsein zählen zuerst und am meisten, Grammatikgenauigkeit erst danach " +
  "und weniger stark — dieselbe Priorität wie bei assessment unten. Richtwerte: 9-10 = würde in einem echten Kundenservice-" +
  "Interview überzeugen, klar und sicher, kaum Fehler von Bedeutung; 7-8 = insgesamt überzeugend und gut verständlich, ein paar " +
  "wiederkehrende Fehler oder Unsicherheiten, die die Verständlichkeit aber nicht ernsthaft stören; 5-6 = verständlich, aber " +
  "merklich zögerlich, unstrukturiert oder mit Fehlern, die ein Kunde bemerken würde; 3-4 = deutlich holprig, schwer zu folgen " +
  "oder sehr unsicher; 1-2 = kaum verständlich oder komplett neben der Sache. Sei ehrlich, aber fair und ermutigend — die Note " +
  "soll motivieren, nicht entmutigen.\n" +
  "2. assessment: Bewerte die Leistung von „Sie\" über das GESAMTE Gespräch hinweg anhand dieser drei Schwerpunkte, in dieser " +
  "Reihenfolge der Wichtigkeit: (a) Klarheit und Tempo — würde ein deutscher Kunde das am Telefon leicht verstehen?, " +
  "(b) Selbstbewusstsein — klingt die Person über das ganze Gespräch hinweg sicher, oder eher zögerlich/unstrukturiert?, " +
  "(c) Gesprächsführung — wie gut ist die Person auf die wechselnden Reaktionen des Kunden eingegangen, und falls es ein Stocken oder " +
  "eine Selbstkorrektur gab, würdige, ob sie sich flüssig wieder gefangen hat. Grammatik erwähnst du hier nur kurz und nachrangig, " +
  "nie als Hauptpunkt. Maximal 4-5 kurze Sätze, freundlich und ermutigend, nie hart oder wie eine Note.\n" +
  "3. grammarMistakes: ECHTE Grammatikfehler in den Zeilen von „Sie\" — falscher Kasus, falsche Verbform, falsche Wortwahl. " +
  "Keine feste Obergrenze: Liste ALLE echten Fehler auf, die du im gesamten Gespräch findest. Wichtige Regeln:\n" +
  "   - Korrigiere NUR eindeutige Grammatik- oder Wortstellungsfehler, die ein deutscher Muttersprachler sofort bemerken würde.\n" +
  "   - Wenn eine Stelle im Transkript unzusammenhängend, abgehackt oder unsinnig wirkt, ist das wahrscheinlich ein Transkriptionsfehler " +
  "(die Aufnahme wurde automatisch transkribiert) und KEIN echter Grammatikfehler — überspringe solche Stellen komplett, erfinde keine Korrektur dafür.\n" +
  "   - \"original\" und \"corrected\" müssen jeweils vollständig und ausschließlich auf Deutsch sein. Mische niemals Englisch " +
  "und Deutsch in einem Satz oder Wort. Wenn du unsicher bist, ob ein Wort/eine Passage korrekt verstanden wurde, überspringe sie.\n" +
  "   - \"corrected\" muss eine natürliche, korrekte deutsche Formulierung dessen sein, was die Person offensichtlich meinte.\n" +
  "   - Lieber weniger, aber sichere Korrekturen als eine erzwungene, unsichere. Ein leeres Array ist völlig in Ordnung.\n" +
  "   Jede Korrektur ist kurz und konkret, keine Grammatiklektion, und freundlich formuliert (kein Rotstift-Ton).\n" +
  "4. naturalPhrasing: Stellen in den Zeilen von „Sie\", die grammatisch KORREKT sind, aber steif, zu wörtlich übersetzt oder nicht " +
  "muttersprachlich klingen. Für jede Stelle: \"original\", \"suggestion\" (wie ein Muttersprachler es eher sagen würde), und " +
  '"reason" — ein kurzer, konkreter Grund. Gleiche Regeln wie bei grammarMistakes (nur Deutsch, keine Transkriptionsfehler ' +
  "übernehmen). Freundlicher Coaching-Ton, keine Kritik.\n" +
  "5. contentIdeas: Konkrete Beobachtungen, die erkennbar aus DIESEM Gespräch stammen — keine allgemeinen, austauschbaren Ratschläge, " +
  "die zu jedem beliebigen Gespräch passen würden. Nenne 1-3 Punkte, die sich auf tatsächliche Momente im Transkript beziehen, " +
  "in beide Richtungen: was „Sie\" gut gemacht hat (z. B. die Frustration des Kunden früh anerkannt, eine Verhandlung geschickt " +
  "geführt, eine Lösung klar erklärt) UND/ODER was „Sie\" an einer konkreten Stelle im Gespräch hätte ergänzen oder anders angehen " +
  "können, um die Situation dort noch überzeugender zu lösen. Jeder Punkt muss auf ein konkretes Detail aus dem Gesprächsverlauf " +
  "verweisen, nicht auf eine generische Empfehlung.\n" +
  "6. modelAnswer: Ein kurzes, überzeugendes Beispiel, wie „Sie\" an einer der schwierigsten Stellen des Gesprächs hätte reagieren " +
  "können — klar als Beispiel gedacht, nicht als Korrektur der tatsächlichen Antwort. Falls im Transkript ein Wort auftaucht, das im " +
  "Kontext unsinnig wirkt oder kein echtes deutsches Wort ist (vermutlich ein Transkriptionsfehler), übernimm es NICHT wörtlich, " +
  "sondern ersetze es gedanklich durch das plausibelste echte deutsche Wort.\n\n" +
  "Antworte ausschließlich mit dem JSON-Objekt, alle Textinhalte auf Deutsch.";

function formatTranscript(messages) {
  return messages
    .map((m) => `${m.role === "assistant" ? "Kunde" : "Sie"}: ${m.content}`)
    .join("\n");
}

export async function POST(request) {
  let groqApiKey;
  try {
    groqApiKey = getGroqApiKey();
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  const { scenarioPrompt, messages } = await request.json();

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getGroqFeedbackModel(),
      max_tokens: MAX_FEEDBACK_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `Szenario: "${scenarioPrompt}"\n\n` +
            `Gesprächstranskript:\n${formatTranscript(messages)}\n\n` +
            "Gib deine Rückmeldung als JSON-Objekt mit den Feldern score, scoreJustification, assessment, grammarMistakes, naturalPhrasing, contentIdeas und modelAnswer zurück.",
        },
      ],
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
      { error: "Conversation feedback failed", details: groqError.rawText },
      { status: 502 }
    );
  }

  const data = await res.json();
  const feedback = JSON.parse(data.choices[0].message.content);

  // Guard against the model drifting outside the requested 1-10 integer range.
  if (typeof feedback.score === "number" && Number.isFinite(feedback.score)) {
    feedback.score = Math.min(10, Math.max(1, Math.round(feedback.score)));
  } else {
    delete feedback.score;
  }

  return Response.json({ feedback });
}

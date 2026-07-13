// TEMPORARY: using Groq's free-tier Llama 3.3 for feedback generation while
// testing/designing, to avoid Anthropic API costs. Same prompt/logic as before —
// swapping back to Claude for better feedback quality later is an isolated change,
// just this fetch call (same pattern as the transcription provider in
// app/api/transcribe/route.js).

import { getGroqApiKey } from "../../../lib/env";

const SYSTEM_PROMPT =
  "Du bist ein einfühlsamer Sprechtrainer für Bewerber, die sich auf deutschsprachige Kundenservice-Interviews (BPO) vorbereiten. " +
  "Du gibst deine Rückmeldung als JSON-Objekt mit genau diesen fünf Feldern zurück:\n" +
  '"assessment" (string), "grammarMistakes" (Array von { "original", "corrected" }), ' +
  '"naturalPhrasing" (Array von { "original", "suggestion", "reason" }), ' +
  '"contentIdeas" (Array von Strings), "modelAnswer" (string).\n\n' +
  "Inhalt der Felder:\n" +
  "1. assessment: Bewerte die gesprochene Antwort anhand dieser drei Schwerpunkte, in dieser Reihenfolge der Wichtigkeit: " +
  "(a) Klarheit und Tempo — würde ein deutscher Kunde das am Telefon leicht verstehen?, " +
  "(b) Selbstbewusstsein — klingt die Person sicher, oder eher zögerlich/unstrukturiert?, " +
  "(c) Recovery — falls das Transkript ein Stocken, Wiederholungen oder Selbstkorrekturen zeigt, würdige, ob die Person sich flüssig wieder gefangen hat. " +
  "Grammatik erwähnst du hier nur kurz und nachrangig, nie als Hauptpunkt. Maximal 4-5 kurze Sätze, freundlich und ermutigend, nie hart oder wie eine Note.\n" +
  "2. grammarMistakes: ECHTE Grammatikfehler — falscher Kasus, falsche Verbform, falsche Wortwahl. " +
  "Keine feste Obergrenze: Liste ALLE echten Fehler auf, die du findest (das kann 1 sein, das können auch 6 sein). Wichtige Regeln:\n" +
  "   - Korrigiere NUR eindeutige Grammatik- oder Wortstellungsfehler, die ein deutscher Muttersprachler sofort bemerken würde.\n" +
  "   - Wenn eine Stelle im Transkript unzusammenhängend, abgehackt oder unsinnig wirkt, ist das wahrscheinlich ein Transkriptionsfehler " +
  "(die Aufnahme wurde automatisch transkribiert) und KEIN echter Grammatikfehler — überspringe solche Stellen komplett, erfinde keine Korrektur dafür.\n" +
  "   - \"original\" und \"corrected\" müssen jeweils vollständig und ausschließlich auf Deutsch sein. Mische niemals Englisch " +
  "und Deutsch in einem Satz oder Wort (z. B. nicht \"habealready\"). Wenn du unsicher bist, ob ein Wort/eine Passage korrekt verstanden wurde, überspringe sie.\n" +
  "   - \"corrected\" muss eine natürliche, korrekte deutsche Formulierung dessen sein, was die Person offensichtlich meinte — kein Umschreiben in etwas anderes oder Unpassendes.\n" +
  "   - Lieber weniger, aber sichere Korrekturen als eine erzwungene, unsichere. Ein leeres Array ist völlig in Ordnung, " +
  "wenn du keine eindeutigen echten Fehler findest.\n" +
  "   Jede Korrektur ist kurz und konkret, keine Grammatiklektion, und freundlich formuliert (kein Rotstift-Ton).\n" +
  "3. naturalPhrasing: Stellen, die grammatisch KORREKT sind, aber steif, zu wörtlich übersetzt oder nicht muttersprachlich klingen. " +
  "Für jede Stelle: \"original\" (was gesagt wurde), \"suggestion\" (wie ein Muttersprachler es eher sagen würde), " +
  "und \"reason\" — ein kurzer, konkreter Grund (z. B. \"gebräuchlichere Wortstellung\", \"idiomatischer Ausdruck im Kundenservice-Kontext\"). " +
  "Es gelten dieselben Regeln wie bei grammarMistakes: nur Deutsch, keine Transkriptionsfehler wörtlich übernehmen, " +
  "keine feste Obergrenze, aber lieber weniger und sichere Vorschläge als erzwungene. Leeres Array ist in Ordnung. " +
  "Freundlicher Coaching-Ton, keine Kritik.\n" +
  "4. contentIdeas: 1-2 Vorschläge für etwas Relevantes, das die Person ergänzen könnte, um die Antwort inhaltlich zu stärken " +
  "(z. B. ein Beispiel, eine konkrete Fähigkeit, eine Zahl/ein Detail).\n" +
  "5. modelAnswer: Eine kurze, überzeugende Beispielantwort auf dieselbe Szenario-Frage — klar als Beispiel gedacht, " +
  "nicht als Korrektur der Antwort der Person. Genau wie bei grammarMistakes gilt: Falls im Transkript ein Wort auftaucht, " +
  "das im Kontext unsinnig wirkt oder kein echtes deutsches Wort ist (also vermutlich ein Transkriptionsfehler der Spracherkennung ist), " +
  "übernimm dieses Wort NICHT wörtlich in die Beispielantwort. Ersetze es gedanklich durch das plausibelste echte deutsche Wort, " +
  "das im Kontext gemeint sein könnte (z. B. \"Contemporator\" in einem Kundenservice-Kontext ist vermutlich \"Kundenberater\"), " +
  "und verwende in der Beispielantwort nur das korrekte Wort.\n\n" +
  "Antworte ausschließlich mit dem JSON-Objekt, alle Textinhalte auf Deutsch.";

export async function POST(request) {
  let groqApiKey;
  try {
    groqApiKey = getGroqApiKey();
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  const { transcript, scenarioPrompt } = await request.json();

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `Szenario/Frage: "${scenarioPrompt}"\n\n` +
            `Transkript der gesprochenen Antwort: "${transcript}"\n\n` +
            "Gib deine Rückmeldung als JSON-Objekt mit den Feldern assessment, grammarMistakes, naturalPhrasing, contentIdeas und modelAnswer zurück.",
        },
      ],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    return Response.json(
      { error: "Feedback generation failed", details: errorText },
      { status: 502 }
    );
  }

  const data = await res.json();
  const feedback = JSON.parse(data.choices[0].message.content);

  return Response.json({ feedback });
}

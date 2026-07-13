import { auth } from "../../../../auth";
import { saveConversationResult } from "../../../../lib/db";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { category, scenarioTitle, scenarioPrompt, score, feedback } = await request.json();
  if (!category || !scenarioTitle || !scenarioPrompt || !feedback) {
    return Response.json({ error: "Ungültige Gesprächsdaten." }, { status: 400 });
  }

  saveConversationResult(Number(session.user.id), {
    category,
    scenarioTitle,
    scenarioPrompt,
    score: typeof score === "number" ? score : null,
    feedback,
  });
  return Response.json({ success: true });
}

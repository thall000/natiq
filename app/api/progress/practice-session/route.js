import { auth } from "../../../../auth";
import { savePracticeSession } from "../../../../lib/db";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { category, questions } = await request.json();
  if (!category || !Array.isArray(questions) || questions.length === 0) {
    return Response.json({ error: "Ungültige Sitzungsdaten." }, { status: 400 });
  }

  await savePracticeSession(Number(session.user.id), category, questions);
  return Response.json({ success: true });
}

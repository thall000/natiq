import Link from "next/link";
import { auth } from "../../auth";
import { getPracticeSessionsForUser, getConversationResultsForUser } from "../../lib/db";
import { getCategoryById } from "../scenarios";
import FeedbackDisplay from "../components/FeedbackDisplay";

function formatDate(sqliteTimestamp) {
  const date = new Date(sqliteTimestamp.replace(" ", "T") + "Z");
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PracticeSessionCard({ session }) {
  const category = getCategoryById(session.category);
  return (
    <div className="card" style={{ borderLeft: "3px solid var(--accent)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
        <h3 style={{ fontSize: "1.05rem" }}>{category?.title ?? session.category}</h3>
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{formatDate(session.created_at)}</span>
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.35rem" }}>
        {session.questions.length} {session.questions.length === 1 ? "Frage" : "Fragen"} geübt
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
        {session.questions.map((q, i) => (
          <details key={i}>
            <summary style={{ cursor: "pointer", color: "var(--accent)", fontSize: "0.9rem" }}>
              {i + 1}. {q.title}
            </summary>
            <div style={{ marginTop: "0.75rem", paddingLeft: "0.25rem" }}>
              <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                <strong>Frage:</strong> {q.prompt}
              </p>
              {q.transcript && (
                <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
                  <strong>Antwort:</strong> {q.transcript}
                </p>
              )}
              {q.feedback && <FeedbackDisplay feedback={q.feedback} />}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function ConversationResultCard({ result }) {
  const category = getCategoryById(result.category);
  return (
    <div className="card" style={{ borderLeft: "3px solid var(--accent-phrasing)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
        <h3 style={{ fontSize: "1.05rem" }}>{result.scenario_title}</h3>
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{formatDate(result.created_at)}</span>
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.35rem" }}>
        {category?.title ?? result.category}
        {typeof result.score === "number" && ` · ${result.score}/10`}
      </p>

      <details style={{ marginTop: "0.75rem" }}>
        <summary style={{ cursor: "pointer", color: "var(--accent)", fontSize: "0.9rem" }}>
          Feedback anzeigen
        </summary>
        <div style={{ marginTop: "0.75rem" }}>
          <FeedbackDisplay feedback={result.feedback} />
        </div>
      </details>
    </div>
  );
}

export default async function ProgressPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="page">
        <Link
          href="/"
          style={{ color: "var(--muted)", fontSize: "0.9rem", display: "block", marginBottom: "1.5rem" }}
        >
          ← Zurück zur Startseite
        </Link>

        <header style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Mein Fortschritt</h1>
          <p style={{ color: "var(--muted)" }}>
            Melden Sie sich an, um Ihren Übungsfortschritt zu speichern und hier zu sehen.
          </p>
        </header>

        <div style={{ display: "flex", gap: "1rem" }}>
          <Link href="/anmelden" className="btn">
            Anmelden
          </Link>
          <Link href="/registrieren" className="btn btn-secondary">
            Konto erstellen
          </Link>
        </div>
      </main>
    );
  }

  const userId = Number(session.user.id);
  const practiceSessions = getPracticeSessionsForUser(userId);
  const conversationResults = getConversationResultsForUser(userId);

  const noHistory = practiceSessions.length === 0 && conversationResults.length === 0;

  return (
    <main className="page">
      <Link
        href="/"
        style={{ color: "var(--muted)", fontSize: "0.9rem", display: "block", marginBottom: "1.5rem" }}
      >
        ← Zurück zur Startseite
      </Link>

      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Mein Fortschritt</h1>
        <p style={{ color: "var(--muted)" }}>Angemeldet als {session.user.email}</p>
      </header>

      {noHistory && (
        <p style={{ color: "var(--muted)" }}>
          Noch keine Übungen abgeschlossen. Starten Sie ein{" "}
          <Link href="/interviews" style={{ color: "var(--accent)" }}>
            Übungsinterview
          </Link>{" "}
          oder ein{" "}
          <Link href="/live" style={{ color: "var(--accent)" }}>
            Live-Gespräch
          </Link>
          .
        </p>
      )}

      {conversationResults.length > 0 && (
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>Live-Gespräche</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {conversationResults.map((result) => (
              <ConversationResultCard key={result.id} result={result} />
            ))}
          </div>
        </section>
      )}

      {practiceSessions.length > 0 && (
        <section>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>Übungsinterviews</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {practiceSessions.map((s) => (
              <PracticeSessionCard key={s.id} session={s} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

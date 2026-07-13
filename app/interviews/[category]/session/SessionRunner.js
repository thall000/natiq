"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import RecordingPanel from "../RecordingPanel";

export default function SessionRunner({ categoryId, initialQuestions }) {
  const { data: authSession } = useSession();
  const [index, setIndex] = useState(0);
  const resultsRef = useRef([]);
  const savedRef = useRef(false);

  const recordResult = (scenario, { transcript, feedback }) => {
    resultsRef.current.push({
      scenarioId: scenario.id,
      title: scenario.title,
      prompt: scenario.prompt,
      transcript,
      feedback,
    });
  };

  const done = index >= initialQuestions.length;

  useEffect(() => {
    if (!done || savedRef.current || !authSession?.user || resultsRef.current.length === 0) return;
    savedRef.current = true;
    fetch("/api/progress/practice-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: categoryId, questions: resultsRef.current }),
    }).catch(() => {
      // Best-effort save — a failed save shouldn't block the "session complete" screen.
    });
  }, [done, authSession, categoryId]);

  if (initialQuestions.length === 0) {
    return (
      <p style={{ color: "var(--muted)" }}>
        Für diese Kategorie gibt es noch keine Übungen.
      </p>
    );
  }

  if (done) {
    return (
      <div className="card" style={{ borderLeft: "4px solid var(--accent)" }}>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Sitzung abgeschlossen
        </h2>
        <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
          Du hast {initialQuestions.length} von {initialQuestions.length} Fragen abgeschlossen.
        </p>
        <Link href={`/interviews/${categoryId}`} className="btn">
          Zurück zur Kategorie
        </Link>
      </div>
    );
  }

  const scenario = initialQuestions[index];
  const isLast = index === initialQuestions.length - 1;

  return (
    <div>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
        Frage {index + 1} von {initialQuestions.length}
      </p>

      <span
        style={{
          fontSize: "0.75rem",
          color: "var(--accent)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {scenario.kind}
      </span>
      <h2 style={{ fontSize: "1.4rem", margin: "0.35rem 0 1rem" }}>{scenario.title}</h2>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "1.1rem" }}>{scenario.prompt}</p>
      </div>

      <RecordingPanel
        key={scenario.id}
        scenario={scenario}
        onAdvance={() => setIndex((i) => i + 1)}
        advanceLabel={isLast ? "Sitzung abschließen" : "Nächste Frage"}
        onFeedbackReady={(result) => recordResult(scenario, result)}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import RecordingPanel from "../RecordingPanel";

export default function SessionRunner({ categoryId, initialQuestions }) {
  const [index, setIndex] = useState(0);

  if (initialQuestions.length === 0) {
    return (
      <p style={{ color: "var(--muted)" }}>
        Für diese Kategorie gibt es noch keine Übungen.
      </p>
    );
  }

  if (index >= initialQuestions.length) {
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
      />
    </div>
  );
}

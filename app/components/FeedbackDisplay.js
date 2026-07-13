"use client";

import { useEffect, useState } from "react";

function ScoreRing({ score, max = 10, size = 84, strokeWidth = 7 }) {
  const [ready, setReady] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const armId = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(armId);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const duration = 700;
    const start = performance.now();
    let frameId;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplayScore(Math.round(progress * score * 10) / 10);
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [ready, score]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = ready ? Math.max(0, Math.min(1, score / max)) : 0;
  const offset = circumference * (1 - fraction);

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--border-soft)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--accent)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease-out" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.4rem",
          fontWeight: 700,
          color: "var(--accent)",
        }}
      >
        {displayScore.toFixed(1)}
      </div>
    </div>
  );
}

export default function FeedbackDisplay({ feedback }) {
  return (
    <div className="fade-in-stagger" style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {typeof feedback.score === "number" && (
        <div
          className="card"
          style={{
            borderLeft: "4px solid var(--accent)",
            background: "var(--surface-accent)",
            padding: "1.75rem",
            display: "flex",
            alignItems: "center",
            gap: "1.5rem",
          }}
        >
          <ScoreRing score={feedback.score} />
          {feedback.scoreJustification && (
            <p style={{ fontSize: "1rem" }}>{feedback.scoreJustification}</p>
          )}
        </div>
      )}

      <div
        className="card"
        style={{
          borderLeft: "4px solid var(--accent)",
          background: "var(--surface-accent)",
          padding: "1.75rem",
        }}
      >
        <h3
          style={{
            fontSize: "1.05rem",
            fontWeight: 600,
            color: "var(--accent)",
            marginBottom: "0.6rem",
          }}
        >
          Gesamteinschätzung
        </h3>
        <p style={{ whiteSpace: "pre-wrap" }}>{feedback.assessment}</p>
      </div>

      {feedback.grammarMistakes?.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid var(--accent-grammar)" }}>
          <h3
            style={{
              fontSize: "0.95rem",
              color: "var(--accent-grammar)",
              marginBottom: "0.85rem",
            }}
          >
            Grammatikfehler
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {feedback.grammarMistakes.map((fix, i) => (
              <div key={i}>
                <p style={{ color: "var(--muted)" }}>
                  Du hast gesagt: „{fix.original}&rdquo;
                </p>
                <p>Versuch mal: „{fix.corrected}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {feedback.naturalPhrasing?.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid var(--accent-phrasing)" }}>
          <h3
            style={{
              fontSize: "0.95rem",
              color: "var(--accent-phrasing)",
              marginBottom: "0.85rem",
            }}
          >
            Natürlichere Formulierungen
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {feedback.naturalPhrasing.map((tip, i) => (
              <div key={i}>
                <p style={{ color: "var(--muted)" }}>
                  Du hast gesagt: „{tip.original}&rdquo;
                </p>
                <p>Ein Muttersprachler würde eher sagen: „{tip.suggestion}&rdquo;</p>
                {tip.reason && (
                  <p style={{ color: "var(--muted)", fontSize: "0.85rem", fontStyle: "italic" }}>
                    {tip.reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {feedback.contentIdeas?.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid var(--accent-content)" }}>
          <h3
            style={{
              fontSize: "0.95rem",
              color: "var(--accent-content)",
              marginBottom: "0.85rem",
            }}
          >
            Ideen für mehr Inhalt
          </h3>
          <ul style={{ paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {feedback.contentIdeas.map((idea, i) => (
              <li key={i}>{idea}</li>
            ))}
          </ul>
        </div>
      )}

      {feedback.modelAnswer && (
        <div
          className="card"
          style={{ borderLeft: "3px solid var(--accent-example)", background: "var(--background)" }}
        >
          <h3
            style={{
              fontSize: "0.95rem",
              color: "var(--accent-example)",
              marginBottom: "0.5rem",
            }}
          >
            Beispielantwort
          </h3>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            So könnte eine überzeugende Antwort klingen:
          </p>
          <p style={{ fontStyle: "italic", whiteSpace: "pre-wrap" }}>
            {feedback.modelAnswer}
          </p>
        </div>
      )}
    </div>
  );
}

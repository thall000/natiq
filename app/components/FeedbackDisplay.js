export default function FeedbackDisplay({ feedback }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
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
          <div
            style={{
              fontSize: "2.75rem",
              fontWeight: 700,
              color: "var(--accent)",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {feedback.score}/10
          </div>
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

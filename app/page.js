import Link from "next/link";
import Logo, { LatticePattern } from "./components/Logo";
import CategoryCard from "./components/CategoryCard";
import ScrollReveal from "./components/ScrollReveal";
import { categories, getScenariosByCategory } from "./scenarios";

const steps = [
  {
    title: "Szenario wählen",
    description: "Wähle eine Branche und eine passende Interviewfrage oder ein Rollenspiel.",
  },
  {
    title: "Antwort aufnehmen",
    description: "Sprich deine Antwort laut ein — genau wie im echten Gespräch, ohne Skript.",
  },
  {
    title: "Feedback erhalten",
    description: "Bekomme ehrliches Feedback zu Klarheit, Grammatik und Inhalt deiner Antwort.",
  },
];

export default function Home() {
  return (
    <main>
      <section style={{ position: "relative", overflow: "hidden", padding: "4.5rem 0" }}>
        <LatticePattern color="var(--accent)" opacity={0.05} />
        <div className="page" style={{ position: "relative", zIndex: 1, paddingTop: 0, paddingBottom: 0 }}>
          <div style={{ marginBottom: "2.25rem" }}>
            <Logo variant="hero" />
          </div>
          <h1 style={{ fontSize: "2.75rem", lineHeight: 1.15, marginBottom: "1.25rem" }}>
            Die echten Fragen. Der echte Druck. Das echte Tempo.
          </h1>
          <p style={{ fontSize: "1.15rem", color: "var(--muted)", marginBottom: "1.75rem", maxWidth: "34rem" }}>
            Natiq bereitet dich gezielt auf echte Vorstellungsgespräche für deutschsprachige
            Kundenservice-Stellen vor — mit echten Interviewfragen, gesprochenen Antworten und
            ehrlichem Feedback. Kein Vokabeltraining, kein generisches Sprachenlernen.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Link href="/interviews" className="btn">
              Interviews starten
            </Link>
            <Link href="/live" className="btn btn-secondary">
              Live-Gespräch üben
            </Link>
            <Link href="/vocabulary" className="btn btn-secondary">
              Customer Care Bible
            </Link>
          </div>
        </div>
      </section>

      <div className="page" style={{ paddingTop: 0 }}>
        <ScrollReveal style={{ marginBottom: "3.5rem" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1.25rem" }}>So funktioniert es</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="card"
                style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}
              >
                <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--accent)" }}>
                  {i + 1}
                </span>
                <div>
                  <h3 style={{ fontSize: "1.05rem", marginBottom: "0.25rem" }}>{step.title}</h3>
                  <p style={{ color: "var(--muted)" }}>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal style={{ marginBottom: "3.5rem" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1.25rem" }}>Kategorien</h2>
          <div className="category-grid">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                href={`/interviews/${category.id}`}
                count={getScenariosByCategory(category.id).length}
                featured={category.ready}
              />
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <section className="card" style={{ background: "var(--surface-accent)" }}>
            <h2 style={{ fontSize: "1.15rem", marginBottom: "0.6rem" }}>Für wen ist Natiq?</h2>
            <p style={{ color: "var(--muted)" }}>
              Natiq richtet sich an Menschen in Ägypten, die sich auf Vorstellungsgespräche für
              deutschsprachige Kundenservice-Stellen vorbereiten — zum Beispiel im telefonischen
              Kundenservice internationaler Unternehmen. Natiq ist ein unabhängiges Übungstool ohne
              Verbindung zu bestimmten Arbeitgebern oder Personalvermittlungen.
            </p>
          </section>
        </ScrollReveal>
      </div>
    </main>
  );
}

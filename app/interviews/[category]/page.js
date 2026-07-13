import Link from "next/link";
import { notFound } from "next/navigation";
import ScrollReveal from "../../components/ScrollReveal";
import { categories, getCategoryById, getScenariosByCategory } from "../../scenarios";

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.id }));
}

export default async function CategoryPage({ params }) {
  const { category: categoryId } = await params;
  const category = getCategoryById(categoryId);
  if (!category) notFound();

  const scenarios = getScenariosByCategory(categoryId);

  return (
    <main className="page">
      <Link
        href="/interviews"
        style={{ color: "var(--muted)", fontSize: "0.9rem", display: "block", marginBottom: "1.5rem" }}
      >
        ← Zurück zu den Kategorien
      </Link>

      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 600 }}>{category.title}</h1>
        <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>{category.summary}</p>
      </header>

      {scenarios.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>
          Für diese Kategorie gibt es noch keine Übungen — schau bald wieder vorbei.
        </p>
      ) : (
        <>
          <div
            className="card"
            style={{
              borderLeft: "4px solid var(--accent)",
              background: "var(--surface-accent)",
              marginBottom: "2rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              alignItems: "flex-start",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Übungsinterview
              </h2>
              <p style={{ color: "var(--muted)" }}>
                {Math.min(scenarios.length, 10)} zufällig ausgewählte Fragen, eine nach der
                anderen, mit Feedback nach jeder Antwort.
              </p>
            </div>
            <Link href={`/interviews/${categoryId}/session`} className="btn">
              Übungsinterview starten
            </Link>
          </div>

          <ScrollReveal>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {scenarios.map((scenario) => (
                <Link key={scenario.id} href={`/interviews/${categoryId}/${scenario.id}`}>
                  <article className="card" style={{ cursor: "pointer" }}>
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
                    <h2 style={{ fontSize: "1.25rem", margin: "0.35rem 0 0.4rem" }}>
                      {scenario.title}
                    </h2>
                    <p style={{ color: "var(--muted)" }}>{scenario.summary}</p>
                  </article>
                </Link>
              ))}
            </div>
          </ScrollReveal>
        </>
      )}
    </main>
  );
}

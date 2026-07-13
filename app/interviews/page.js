import Link from "next/link";
import CategoryCard from "../components/CategoryCard";
import ScrollReveal from "../components/ScrollReveal";
import { categories, getScenariosByCategory } from "../scenarios";

export default function InterviewsPage() {
  return (
    <main className="page">
      <Link
        href="/"
        style={{ color: "var(--muted)", fontSize: "0.9rem", display: "block", marginBottom: "1.5rem" }}
      >
        ← Zurück zur Startseite
      </Link>

      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Interviews</h1>
        <p style={{ color: "var(--muted)" }}>
          Wähle eine Branche, um passende Übungen zu finden.
        </p>
      </header>

      <ScrollReveal>
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
    </main>
  );
}

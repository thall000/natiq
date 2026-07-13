import Link from "next/link";
import CategoryCard from "../components/CategoryCard";
import ScrollReveal from "../components/ScrollReveal";
import { categories } from "../scenarios";

export default function LiveHubPage() {
  return (
    <main className="page">
      <Link
        href="/"
        style={{ color: "var(--muted)", fontSize: "0.9rem", display: "block", marginBottom: "1.5rem" }}
      >
        ← Zurück zur Startseite
      </Link>

      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Live-Gespräch üben</h1>
        <p style={{ color: "var(--muted)" }}>
          Wähle eine Branche und führe ein echtes gesprochenes Gespräch mit einer
          KI-Kundenpersona — Feedback gibt es erst am Ende des Gesprächs.
        </p>
      </header>

      <ScrollReveal>
        <div className="category-grid">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              href={`/live/${category.id}`}
              featured={category.ready}
            />
          ))}
        </div>
      </ScrollReveal>
    </main>
  );
}

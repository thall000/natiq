import Link from "next/link";
import { notFound } from "next/navigation";
import { categories, getCategoryById, getRandomRoleplayByCategory } from "../../scenarios";
import LiveConversation from "./LiveConversation";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.id }));
}

export default async function LiveRoomPage({ params }) {
  const { category: categoryId } = await params;
  const category = getCategoryById(categoryId);
  if (!category) notFound();

  const scenario = getRandomRoleplayByCategory(categoryId);
  if (!scenario) notFound();

  return (
    <main className="page">
      <Link
        href="/live"
        style={{ color: "var(--muted)", fontSize: "0.9rem", display: "block", marginBottom: "1.5rem" }}
      >
        ← Zurück zu den Kategorien
      </Link>

      <span
        style={{
          fontSize: "0.75rem",
          color: "var(--accent)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Live-Gespräch — {category.title}
      </span>
      <h1 style={{ fontSize: "1.75rem", margin: "0.35rem 0 1rem" }}>{scenario.title}</h1>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "1.1rem" }}>{scenario.prompt}</p>
      </div>

      <LiveConversation scenarioPrompt={scenario.prompt} />
    </main>
  );
}

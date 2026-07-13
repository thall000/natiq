import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryById, getScenarioById, scenarios } from "../../../scenarios";
import RecordingPanel from "../RecordingPanel";

export function generateStaticParams() {
  return scenarios.map((s) => ({ category: s.category, id: s.id }));
}

export default async function ScenarioPage({ params }) {
  const { category: categoryId, id } = await params;
  const category = getCategoryById(categoryId);
  const scenario = getScenarioById(id);
  if (!category || !scenario || scenario.category !== categoryId) notFound();

  return (
    <main className="page">
      <Link
        href={`/interviews/${categoryId}`}
        style={{ color: "var(--muted)", fontSize: "0.9rem", display: "block", marginBottom: "1.5rem" }}
      >
        ← Zurück zu {category.title}
      </Link>

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
      <h1 style={{ fontSize: "1.75rem", margin: "0.35rem 0 1rem" }}>
        {scenario.title}
      </h1>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "1.1rem" }}>{scenario.prompt}</p>
      </div>

      <RecordingPanel scenario={scenario} />
    </main>
  );
}

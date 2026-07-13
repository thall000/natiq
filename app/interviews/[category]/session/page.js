import Link from "next/link";
import { notFound } from "next/navigation";
import { categories, getCategoryById, getRandomScenariosByCategory } from "../../../scenarios";
import SessionRunner from "./SessionRunner";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.id }));
}

export default async function SessionPage({ params }) {
  const { category: categoryId } = await params;
  const category = getCategoryById(categoryId);
  if (!category) notFound();

  const questions = getRandomScenariosByCategory(categoryId);

  return (
    <main className="page">
      <Link
        href={`/interviews/${categoryId}`}
        style={{ color: "var(--muted)", fontSize: "0.9rem", display: "block", marginBottom: "1.5rem" }}
      >
        ← Zurück zu {category.title}
      </Link>

      <h1 style={{ fontSize: "1.75rem", fontWeight: 600, marginBottom: "1.5rem" }}>
        Übungsinterview — {category.title}
      </h1>

      <SessionRunner categoryId={categoryId} initialQuestions={questions} />
    </main>
  );
}

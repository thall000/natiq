import Link from "next/link";
import CategoryIcon from "./CategoryIcon";

export default function CategoryCard({ category, href, count, featured }) {
  if (featured) {
    return (
      <Link href={href} className="featured">
        <article
          className="card"
          style={{
            padding: "2rem",
            boxShadow: "var(--shadow-card-lg)",
            cursor: "pointer",
            display: "flex",
            gap: "1.25rem",
            alignItems: "flex-start",
          }}
        >
          <div style={{ color: "var(--accent)", flexShrink: 0 }}>
            <CategoryIcon id={category.id} size={32} />
          </div>
          <div>
            <p
              style={{
                fontSize: "0.7rem",
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "0.4rem",
              }}
            >
              Jetzt verfügbar
            </p>
            <h3 style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>{category.title}</h3>
            <p style={{ color: "var(--muted)" }}>{category.summary}</p>
            {typeof count === "number" && (
              <p style={{ color: "var(--accent)", fontSize: "0.85rem", marginTop: "0.6rem" }}>
                {count} {count === 1 ? "Übung" : "Übungen"} verfügbar
              </p>
            )}
          </div>
        </article>
      </Link>
    );
  }

  return (
    <div className="card" style={{ opacity: 0.5, padding: "1.25rem" }}>
      <div style={{ color: "var(--muted)", marginBottom: "0.6rem" }}>
        <CategoryIcon id={category.id} size={24} />
      </div>
      <h3 style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>{category.title}</h3>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{category.summary}</p>
      <p style={{ color: "var(--accent)", fontSize: "0.75rem", marginTop: "0.5rem" }}>
        In Vorbereitung
      </p>
    </div>
  );
}

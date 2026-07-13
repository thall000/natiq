"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function AuthHeaderStatus() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div style={{ width: "5.5rem" }} />;
  }

  if (!session) {
    return (
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", fontSize: "0.85rem" }}>
        <Link href="/anmelden" style={{ color: "var(--muted)" }}>
          Anmelden
        </Link>
        <Link href="/registrieren" className="btn" style={{ padding: "0.5rem 1rem" }}>
          Registrieren
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", fontSize: "0.85rem" }}>
      <Link href="/fortschritt" style={{ color: "var(--muted)" }}>
        Mein Fortschritt
      </Link>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ padding: "0.5rem 1rem" }}
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        Abmelden
      </button>
    </div>
  );
}

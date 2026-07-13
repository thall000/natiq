"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("E-Mail-Adresse oder Passwort ist falsch.");
      setSubmitting(false);
      return;
    }

    router.push("/fortschritt");
  };

  return (
    <main className="page" style={{ maxWidth: "420px" }}>
      <Link
        href="/"
        style={{ color: "var(--muted)", fontSize: "0.9rem", display: "block", marginBottom: "1.5rem" }}
      >
        ← Zurück zur Startseite
      </Link>

      <header style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Anmelden</h1>
        <p style={{ color: "var(--muted)" }}>
          Melden Sie sich an, um Ihren gespeicherten Übungsfortschritt zu sehen.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        <div className="field">
          <label htmlFor="email">E-Mail-Adresse</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Passwort</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? "Wird angemeldet …" : "Anmelden"}
        </button>
      </form>

      <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "1.25rem" }}>
        Noch kein Konto?{" "}
        <Link href="/registrieren" style={{ color: "var(--accent)" }}>
          Jetzt registrieren
        </Link>
      </p>
    </main>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.");
        setSubmitting(false);
        return;
      }

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        router.push("/anmelden");
        return;
      }

      router.push("/fortschritt");
    } catch (err) {
      setError("Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.");
      setSubmitting(false);
    }
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
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Konto erstellen</h1>
        <p style={{ color: "var(--muted)" }}>
          Speichern Sie Ihren Übungsfortschritt — optional, Sie können Natiq auch ohne
          Konto vollständig nutzen.
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
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="passwordConfirm">Passwort bestätigen</label>
          <input
            id="passwordConfirm"
            type="password"
            autoComplete="new-password"
            required
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? "Wird erstellt …" : "Konto erstellen"}
        </button>
      </form>

      <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "1.25rem" }}>
        Bereits registriert?{" "}
        <Link href="/anmelden" style={{ color: "var(--accent)" }}>
          Jetzt anmelden
        </Link>
      </p>
    </main>
  );
}

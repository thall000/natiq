import { hash } from "@node-rs/bcrypt";
import { createUser, getUserByEmail } from "../../../lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  const { email, password } = await request.json();
  const normalizedEmail = (email || "").toString().trim().toLowerCase();

  if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
    return Response.json(
      { error: "Bitte geben Sie eine gültige E-Mail-Adresse ein." },
      { status: 400 }
    );
  }
  if (!password || password.toString().length < 8) {
    return Response.json(
      { error: "Das Passwort muss mindestens 8 Zeichen lang sein." },
      { status: 400 }
    );
  }
  if (getUserByEmail(normalizedEmail)) {
    return Response.json(
      { error: "Für diese E-Mail-Adresse existiert bereits ein Konto." },
      { status: 409 }
    );
  }

  const passwordHash = await hash(password.toString(), 10);
  createUser(normalizedEmail, passwordHash);

  return Response.json({ success: true });
}

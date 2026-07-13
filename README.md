# Natiq

Natiq is a spoken-German interview practice tool for people preparing for German-language
customer service jobs — for example, telephone customer support roles at international
companies, commonly hired for out of Egypt. It is an independent practice tool, not
affiliated with any employer or recruiter.

It is not a vocabulary app or a generic language-learning app. Every exercise is built
around the actual pressure of a real interview or a real customer call: you get a prompt,
you speak your answer out loud, and you get honest feedback on clarity, grammar, and
content — not just "correct" or "incorrect."

## Features

- **Static interview practice** (`/interviews`) — Pick an industry (Telekommunikation,
  Einzelhandel, Reise & Tourismus, Gastgewerbe, Autovermietung), then either browse
  individual interview questions and roleplay prompts, or run a **practice session** of
  10 randomly-selected questions in a row. For each question you can reveal a native-speaker
  reference answer, record your spoken answer, get it transcribed, and receive structured
  feedback (score, grammar corrections, natural-phrasing suggestions, content ideas, and a
  model answer).
- **Live AI conversations** (`/live`) — A hands-free, real-time roleplay against an AI
  customer persona, with 10 scenarios per industry (50 total), each varying the customer's
  mood, difficulty, and situation. You speak, voice activity detection (VAD) automatically
  detects when your turn ends (no push-to-talk button, with a live mic-level meter so the
  hands-free flow stays legible), your speech is transcribed, the AI customer replies in
  character with synthesized speech, and the conversation continues turn by turn. Feedback
  on your entire performance is generated once you end the conversation.
- **Customer Care Bible** (`/vocabulary`) — A reference glossary of customer-service German
  vocabulary (nouns, verbs, adjectives, phrases) organized by topic, with tap-to-reveal
  English and Arabic translations.
- **Optional accounts & saved progress** (`/anmelden`, `/registrieren`, `/fortschritt`) —
  Create an account (email + password) to have your completed practice sessions and live
  conversation results saved and listed newest-first on **Mein Fortschritt**. Accounts are
  entirely optional — every feature above works fully without signing in; logged-out users
  just don't get history saved.

## Tech stack

- **Next.js 16** (App Router) + **React 19** — see the note below, this is *not* a standard
  Next.js version.
- **Groq API**:
  - `whisper-large-v3` for speech-to-text transcription (German, domain-biased prompt).
  - `llama-3.3-70b-versatile` for the AI customer persona (live conversations) and for
    generating feedback (both single-answer and full-conversation).
- **Piper TTS** (local, offline) — synthesizes the AI customer's spoken replies in the live
  conversation feature, using the German `de_DE-thorsten-high` voice. Runs as a local
  child process, not a cloud API.
- **Auth.js (next-auth) v5** with a Credentials provider — self-hosted email/password auth,
  no external auth service. Passwords are hashed with `@node-rs/bcrypt`.
- **SQLite** (via `better-sqlite3`, raw SQL, no ORM) for user accounts and saved progress —
  a single local file at `data/natiq.db`, gitignored.
- Plain JavaScript (no TypeScript), CSS via `globals.css` with CSS variables for theming
  (light/dark mode) and a small set of shared motion utilities (fade-in transitions, an
  animated score ring, a live mic-level meter).

> **Note on the Next.js version:** this project intentionally pins a Next.js release that
> is *not* the Next.js most tooling and training data expects — see `AGENTS.md` at the repo
> root. If you're using an AI coding assistant on this repo, have it read
> `node_modules/next/dist/docs/` before making changes, since APIs and conventions may
> differ from what it assumes.

## Running locally

### 1. Prerequisites

- Node.js (project currently developed against Node 24; any reasonably recent Node 20+
  should work).
- A [Groq API key](https://console.groq.com/keys) (used for transcription, the AI customer
  persona, and feedback generation — Groq's free tier is what this project currently runs
  on).
- **Piper TTS**, set up separately (see below) — required only for the **live conversation**
  feature. Static interview practice, the vocabulary reference, and accounts/saved progress
  all work without it.

### 2. Install and configure

```bash
npm install
```

Create `.env.local` in the project root:

```
GROQ_API_KEY=your_groq_api_key_here
AUTH_SECRET=generate_a_random_string_here
```

Generate `AUTH_SECRET` with, e.g., `openssl rand -base64 32` (or any random 32+ character
string) — it's used to sign session tokens. The dev server will print a clear startup
warning naming any missing required variable, and API routes that need `GROQ_API_KEY` fail
with a message telling you exactly that, rather than a cryptic upstream error.

(`ANTHROPIC_API_KEY` is not currently used by any route — feedback and conversation
generation both run on Groq's Llama 3.3 for now. See `PROJECT_CONTEXT.md` for why.)

### 3. Set up Piper TTS (required for `/live`)

This project shells out to a local `piper.exe` rather than calling a cloud TTS API. By
default it expects everything at `C:\piper`:

```
C:\piper\piper.exe
C:\piper\de_DE-thorsten-high.onnx
```

To set this up:

1. Download a Windows build of [Piper](https://github.com/OHF-Voice/piper1-gpl) (or the
   original [rhasspy/piper](https://github.com/rhasspy/piper) releases) and extract it to
   `C:\piper`, so `piper.exe` sits directly in that folder.
2. Download the German Thorsten "high" quality voice — both the `.onnx` model file and its
   matching `.onnx.json` config — from the
   [Piper voices repository](https://huggingface.co/rhasspy/piper-voices/tree/main/de/de_DE/thorsten/high),
   and place both files in `C:\piper` as `de_DE-thorsten-high.onnx` (and the accompanying
   `.json`).
3. If you install Piper somewhere other than `C:\piper`, set `PIPER_DIR` in `.env.local` to
   point at that folder instead — see `app/api/speak/piperClient.js`.

The dev server spawns `piper.exe` as a persistent child process on first request to
`/api/speak` and keeps it alive across requests (see `PROJECT_CONTEXT.md` for details).

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The SQLite database file is created
automatically on first use at `data/natiq.db` — no setup step needed, and it's gitignored.

## Project docs

See `PROJECT_CONTEXT.md` for a detailed technical breakdown of the architecture, every
route, key components, known limitations, and the current state of each feature — written
so another engineer or AI tool can pick up full context quickly.

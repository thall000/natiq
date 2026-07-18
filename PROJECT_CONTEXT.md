# Natiq — Project Context (for AI tools and reviewers)

This file exists so an AI tool (or a human) reading this repo cold — with no memory of
prior conversations about it — can get accurate, complete context in one pass. It
describes what actually exists in the code as of this writing, not the intended end state.
If something below looks wrong, trust the code over this file and update this file.

## What this project is

Natiq helps people (primarily in Egypt) prepare for German-language customer service job
interviews and calls. It is a Next.js app with a Turso (libSQL) database for optional
accounts and saved progress, and every feature also works fully without an account.

**Read `AGENTS.md` before making changes.** This repo intentionally pins a Next.js version
that is not the Next.js most training data or tooling assumes — check
`node_modules/next/dist/docs/` for the actual current API surface before writing code that
assumes familiar Next.js conventions. Two concrete breaking changes discovered so far:
`middleware.js` is deprecated and renamed to `proxy.js` (same API, same `config.matcher`,
just a new file name and export name) as of v16.0.0; and `serverExternalPackages` in
`next.config.js` ships with a large pre-populated default list (includes `better-sqlite3`,
`bcrypt`, `@node-rs/bcrypt`, `argon2`, `@prisma/client`) so common native-binding packages
work with zero extra config.

## Architecture at a glance

- **Framework**: Next.js 16.2.10, App Router only (no Pages Router), plain JavaScript (no
  TypeScript — `jsconfig.json` only sets up the `@/*` path alias, which nothing in the
  codebase actually uses — all imports are relative. There is no build-time type checking
  anywhere in this project).
- **UI**: Server Components for static/data-driven pages, Client Components (`"use client"`)
  for anything interactive (recording, playback, live conversation state machines, forms).
  Styling is hand-written inline `style={}` objects plus a shared `app/globals.css` for
  theme variables (`--accent`, `--muted`, `--surface-accent`, etc.), reusable classes
  (`.card`, `.btn`, `.page`, `.field`, `.vocab-*`), and a small motion system (see below).
  No CSS framework, no component library.
- **Data**: Interview/roleplay content and vocabulary live in static JS modules, imported
  directly by pages — there is no CMS:
  - `app/scenarios.js` — categories + interview/roleplay scenarios (~3000 lines).
  - `app/vocabulary.js` + `app/vocabulary-translations.js` — the Customer Care Bible content.
- **Persistence**: `lib/db.js` opens a Turso (libSQL) database via `@libsql/client`, cached
  on `globalThis`, with three tables: `users`, `practice_sessions`, `conversation_results`.
  Plain SQL (async — `@libsql/client` is a network client, not a sync local driver), no
  ORM, no migration tooling — schema is created with `CREATE TABLE IF NOT EXISTS` at module
  load. A separate dev/prod database is selected by `NODE_ENV` (see `lib/env.js`'s
  `getTursoCredentials()`) — this was a deliberate migration off the original local SQLite
  file specifically because typical deployment targets (Render, Vercel) have an ephemeral
  filesystem that can't hold a local database file.
- **Auth**: `auth.js` (project root) configures Auth.js (`next-auth`) v5 with a Credentials
  provider, JWT session strategy, password hashing via `@node-rs/bcrypt`. No OAuth
  providers, no email verification, no password reset flow.
- **External services**: Groq API (LLM + Whisper transcription), Turso (database), and
  text-to-speech in one of two modes depending on deployment target — a local/Render Piper
  TTS process, or the browser's own `window.speechSynthesis` on Vercel (see "Deployment"
  below). No other third-party services. No Anthropic/Claude calls currently happen at
  runtime despite `ANTHROPIC_API_KEY` existing as an env var slot (see "Known limitations").

## Routes

### Pages (`app/**/page.js`)

| Route | Type | Purpose |
|---|---|---|
| `/` | Server | Landing page: hero, "how it works" steps, category grid, audience blurb. |
| `/interviews` | Server | Lists all 5 categories with scenario counts. |
| `/interviews/[category]` | Server (`generateStaticParams`) | Lists all scenarios in a category; entry point to either browse one question or start a 10-question session. |
| `/interviews/[category]/[id]` | Server (`generateStaticParams`) | A single scenario: prompt + `RecordingPanel`. |
| `/interviews/[category]/session` | Server, `dynamic = "force-dynamic"` | Picks 10 random non-roleplay scenarios for the category and renders `SessionRunner`, which now also accumulates per-question results and saves them (if logged in) once the session completes. |
| `/live` | Server | Lists categories for the live-conversation feature. |
| `/live/[category]` | Server, `dynamic = "force-dynamic"` | Picks one random roleplay scenario for the category (`getRandomRoleplayByCategory`, now 10 per category) and renders `LiveConversation`, passing `categoryId`/`scenarioTitle` through for progress-saving. |
| `/vocabulary` | Client (`"use client"`) | Customer Care Bible — renders all vocabulary sections, with click-to-toggle translation popovers. |
| `/anmelden` | Client | Sign-in form; calls `signIn("credentials", { redirect: false })` from `next-auth/react`, then redirects to `/fortschritt`. |
| `/registrieren` | Client | Sign-up form; `POST /api/register` to create the account, then immediately calls `signIn` and redirects — no separate "check your email" step (there's no email service). |
| `/fortschritt` | Server | "Mein Fortschritt" — calls `auth()` directly; if no session, shows a sign-in/sign-up prompt; if logged in, queries `lib/db.js` directly for that user's `practice_sessions` and `conversation_results` and renders them newest-first, each with a native `<details>` disclosure showing the full `FeedbackDisplay`. |

### API routes (`app/api/**/route.js`) — all server-only

| Route | Calls | Purpose |
|---|---|---|
| `/api/transcribe` (POST) | Groq `whisper-large-v3` | Accepts a `multipart/form-data` audio blob, returns `{ transcript }`. Uses a fixed German vocabulary-biasing prompt. `maxDuration = 30`. Now calls `getGroqApiKey()` from `lib/env.js` first and returns a clean `500` with an explicit message if the key is missing, instead of forwarding Groq's own error. |
| `/api/feedback` (POST) | Groq `llama-3.3-70b-versatile` | Grades a single transcript against a scenario prompt. Returns `{ feedback: { assessment, grammarMistakes[], naturalPhrasing[], contentIdeas[], modelAnswer } }` (no `score` field — see naming inconsistency note below). Same `getGroqApiKey()` guard as above. |
| `/api/conversation` (POST) | Groq `llama-3.3-70b-versatile` | Drives the AI customer's next line in a live roleplay. Returns `{ line }`. Same guard. |
| `/api/conversation-feedback` (POST) | Groq `llama-3.3-70b-versatile` | Grades a full conversation transcript at once. Returns `{ feedback: { score, scoreJustification, assessment, grammarMistakes[], naturalPhrasing[], contentIdeas[], modelAnswer } }`, clamping `score` to an integer 1–10 or dropping it. Same guard. |
| `/api/speak` (POST) | Local Piper process (`piperClient.js`) | Accepts `{ text }`, returns `audio/wav`. `maxDuration = 30`. Only reachable when `getTtsMode()` resolves to `"piper"` — returns `501` otherwise (Vercel/browser mode never calls this route at all; the client speaks directly via `window.speechSynthesis`). |
| `/api/auth/[...nextauth]` (GET/POST) | — | Re-exports `handlers` from `auth.js` — this is the whole Auth.js wiring for the route handler. |
| `/api/register` (POST) | — | Validates email format + password length (≥8 chars), checks for an existing account, hashes the password (`@node-rs/bcrypt`), inserts the user. No CSRF token needed beyond what Auth.js itself provides for the sign-in call that follows client-side. |
| `/api/progress/practice-session` (POST) | — | Requires a session (`auth()`); saves `{ category, questions: [{ scenarioId, title, prompt, transcript, feedback }] }` for the logged-in user. Called once by `SessionRunner` when a 10-question session completes, only if `useSession()` shows a user. |
| `/api/progress/conversation` (POST) | — | Requires a session; saves `{ category, scenarioTitle, scenarioPrompt, score, feedback }`. Called once by `LiveConversation` after `/api/conversation-feedback` resolves, only if logged in. |

**Naming inconsistency to be aware of:** `/api/feedback` (single answer) does *not* return a
`score`, only `/api/conversation-feedback` (full conversation) does, even though both use
almost the same system prompt structure and both render through the same
`FeedbackDisplay` component (which conditionally shows the score ring only if
`feedback.score` is a number). This looks intentional — grading a 30-second answer
numerically might feel arbitrary — but is worth confirming before assuming otherwise. One
consequence: saved practice-session history in `Mein Fortschritt` never shows per-question
scores, only the full assessment text; saved conversation results always show a score.

## Key components

- **`lib/db.js`** — Opens a Turso `@libsql/client`, cached on `globalThis.__natiqDb` /
  `globalThis.__natiqDbSchemaReady` (same Turbopack-HMR-survival pattern `piperClient.js`
  uses for its child process, but genuinely serverless-safe here since a libSQL client has
  no persistent-process requirement — it reconnects fine across cold starts). Every
  exported function is now `async`: `getUserByEmail`, `getUserById`, `createUser`,
  `savePracticeSession`, `saveConversationResult`, `getPracticeSessionsForUser`,
  `getConversationResultsForUser` — every caller `await`s them. JSON columns
  (`questions_json`, `feedback_json`) are stringified on write and parsed on read by these
  functions — callers never touch raw SQL rows directly.
- **`lib/env.js`** — `getGroqApiKey()` (throws if unset), `getTursoCredentials()` (picks
  `TURSO_DEV_*`/`TURSO_PROD_*` by `NODE_ENV`, throws if either half missing),
  `checkPiperInstall()` (returns a warning string, not a throw, if the resolved Piper
  binary/model isn't found on disk), `getTtsMode()` (resolves `"piper"`/`"browser"` — see
  "Deployment" below), and `checkRequiredEnvVars()` (used by `instrumentation.js`).
- **`instrumentation.js`** (project root) — `register()` runs once at server startup (skips
  the edge runtime), prints a loud console warning naming any missing required env var
  (`GROQ_API_KEY`, `AUTH_SECRET`, the active `TURSO_*` pair), logs the resolved TTS mode,
  and — only when that mode is `"piper"` — warns if the Piper binary/model isn't found on
  disk, rather than letting any of this surface later as a cryptic runtime error.
- **`auth.js`** (project root) — `NextAuth({...})` config: JWT session strategy, Credentials
  provider whose `authorize()` looks up the user by email in Turso (`await getUserByEmail`)
  and verifies the password with `@node-rs/bcrypt`. Exports `{ handlers, auth, signIn,
  signOut }`. `auth()` is called directly in Server Components/Route Handlers wherever a
  session check is needed — there is **no `proxy.js`/middleware file** and no global route
  protection, because nothing in the app is hard-gated behind login (see Phase 1
  requirements below).
- **`app/components/AuthHeaderStatus.js`** (Client) — Shows "Anmelden / Registrieren" links
  when logged out, or "Mein Fortschritt" + an "Abmelden" (`signOut`) button when logged in.
  Uses `useSession()`, so it needs `SessionProviderWrapper` above it in the tree.
- **`app/components/SessionProviderWrapper.js`** (Client) — Thin wrapper around
  `next-auth/react`'s `<SessionProvider>`, so the Server Component `layout.js` can still
  render it around `children` (standard Server→Client interleaving).
- **`app/components/FeedbackDisplay.js`** (Client, was a plain function component before
  Phase 3) — Shared renderer for both feedback shapes. Now includes an internal `ScoreRing`
  component: an animated SVG circular progress ring with a count-up number, driven by a
  two-phase mount (`ready` flips true one frame after mount so the CSS
  `stroke-dashoffset`/count-up transition actually animates from zero instead of snapping
  straight to the final value). The whole section list is wrapped in `.fade-in-stagger`
  (CSS-only staggered entrance, see globals.css) for a calmer reveal.
- **`app/interviews/[category]/RecordingPanel.js`** (Client) — Core single-question
  practice loop, now also accepts an `onFeedbackReady({ transcript, feedback })` callback
  (fired alongside `setFeedback` in `getFeedback()`) so `SessionRunner` can accumulate
  results without RecordingPanel needing to know anything about saving/auth itself.
- **`app/interviews/[category]/session/SessionRunner.js`** (Client) — Steps through 10
  scenarios client-side by index (unchanged from before), and now: collects each
  question's result via `onFeedbackReady` into a `useRef` array (not state — no need to
  re-render on accumulation), and once `index >= initialQuestions.length`, a `useEffect`
  guarded by a `savedRef` flag POSTs the accumulated results to
  `/api/progress/practice-session` exactly once, only if `useSession()` shows a logged-in
  user. Save failures are swallowed (best-effort — shouldn't block the "session complete"
  screen).
- **`app/live/[category]/LiveConversation.js`** (Client) — The live roleplay state machine.
  Takes `categoryId`/`scenarioTitle`/`ttsMode` props (`ttsMode` resolved server-side by
  `page.js` via `getTtsMode()`) and POSTs to `/api/progress/conversation` after receiving
  conversation feedback (if logged in); the `[leak-check]`/`[speak-check]` console
  instrumentation is routed through module-level `devLog`/`devWarn` helpers that no-op when
  `process.env.NODE_ENV === "production"` (one exception: the `[speak] Synthesis failed...`
  line is a real error, left as a plain `console.error` so it's never silenced); phase-change
  text has a `.fade-in` class and a `.speaking-indicator` (three bouncing dots) shows
  next to "Der Kunde antwortet"/"Der Kunde spricht". The `speak()` callback branches on
  `ttsMode`: `"piper"` keeps the original sentence-split + one-sentence-lookahead
  fetch-ahead-of-playback pipeline against `/api/speak` (`synthesizeSentence` +
  `new Audio(blobUrl)`); `"browser"` uses a new `speakBrowser()` helper that speaks the same
  split sentences sequentially via `window.speechSynthesis`/`SpeechSynthesisUtterance` (no
  fetch, no prefetch pipeline needed — synthesis is instant) with a bounded
  (≤300ms, empirically near-instant in Chrome) wait for `getVoices()`/`voiceschanged` to
  pick a German (`lang` starting `"de"`) voice if the list hasn't loaded yet. Both paths
  share the same `onAudioStart`/`onDone` callback contract and the same
  `cancelPlaybackRef`-based cancellation used by `stopSpeaking()`, so `requestNextLine()` and
  `HandsFreeRecorder` need no knowledge of which backend is active.
- **`app/live/[category]/HandsFreeRecorder.js`** (Client) — Voice Activity Detection (VAD),
  structurally unchanged from before Phase 3. Now also renders a live 5-bar mic-level meter
  (`.mic-bars`/`.mic-bar` in globals.css) during calibrating/listening/recording, updated by
  a new `updateBars(rms)` function called every frame from both `calibrate()` and
  `monitor()` — it writes `bar.style.transform` directly via refs (not React state), so the
  meter repaints every animation frame with zero extra re-renders. This is genuinely
  reactive to the real RMS amplitude already being computed for speech detection, not a
  decorative loop.
- **`app/api/speak/piperClient.js`** — Manages a single long-lived Piper child process per
  Node process, cached on `globalThis` to survive Turbopack HMR. Platform-detects its own
  binary path/extension (`C:\piper\piper.exe` on Windows, `vendor/piper/piper` on Linux by
  default, `PIPER_DIR` overridable on both) — everything else in the file (the FIFO
  stdin/stdout queue, crash/respawn handling) is OS-agnostic and unchanged by platform.
  `app/api/speak/route.js` only imports this module lazily, after confirming
  `getTtsMode() === "piper"`, so it's never touched at all when running in browser-TTS mode.
- **`scripts/setup-piper.js`** — `postinstall` hook (runs after every `npm install`,
  including Render's default build). No-ops on Windows. On Linux, no-ops if `getTtsMode()`
  resolves to `"browser"` (e.g. on Vercel, where the download would never be used), or if
  Piper is already installed and looks intact (binary + model present, model ≥100MB).
  Otherwise downloads `rhasspy/piper`'s `2023.11.14-2` Linux release tarball and the German
  Thorsten "high" voice model from Hugging Face into `vendor/piper/` (gitignored), sets the
  binary's executable bit, and fails the build loudly on any error.

## Content inventory

- **5 categories**, all `ready: true`: Telekommunikation, Einzelhandel, Reise & Tourismus,
  Gastgewerbe, Autovermietung.
- **249 scenarios total** across those categories, of which **50 are roleplay scenarios**
  (`kind: "Rollenspiel"`, exactly **10 per category** as of Phase 2), used by the
  live-conversation feature. The rest are standard interview questions (`kind:
  "Interviewfrage"`) tagged with a `type` (`standard`, `technical`, `curveball`, `stress`,
  `rapid-follow-up`, `ethical`) and a `difficulty` (`easy`/`medium`/`hard`) — every
  roleplay scenario now also carries a `difficulty` field (backfilled onto the original 6
  in Phase 2 for consistency), though nothing currently filters or selects by it;
  `getRandomRoleplayByCategory` still picks uniformly at random regardless of difficulty.
  Every interview-question scenario includes a `referenceAnswer`; roleplay scenarios do not
  (the AI generates the customer's lines live instead).
- Each roleplay scenario's prose is written to convey a specific customer mood (angry,
  confused, impatient, friendly-but-firm, distressed) — this is expressed only in the
  `prompt`/`summary` text, not as a separate structured field.
- The Customer Care Bible (`app/vocabulary.js`) is organized into sections with `nomen`,
  `verben`, `adjektive`, and `phrasen` arrays; `app/vocabulary-translations.js` maps each
  word/phrase string to `{ en, ar }` translations looked up by exact string match.

## Database schema (Turso, dev/prod databases per `NODE_ENV`)

```sql
users (id, email UNIQUE, password_hash, created_at)
practice_sessions (id, user_id, category, questions_json, created_at)
conversation_results (id, user_id, category, scenario_title, scenario_prompt, score, feedback_json, created_at)
```

No migrations tooling — the schema is just `CREATE TABLE IF NOT EXISTS` run (as a `batch`)
at module load in `lib/db.js`. Changing a column later means writing a manual
`ALTER TABLE` (or wiping the dev database via the Turso dashboard/CLI — the dev database
itself is disposable, unlike prod).

## Deployment

Three real targets exist today, each with a different TTS mode and (for the DB) the same
Turso backend but a different logical database:

| Target | `NODE_ENV` | `process.env.VERCEL` | TTS mode (auto) | Turso DB |
|---|---|---|---|---|
| Local dev (Windows) | `development` | unset | `piper` (`C:\piper`) | `TURSO_DEV_*` |
| Render | `production` | unset | `piper` (`vendor/piper`, auto-downloaded) | `TURSO_PROD_*` |
| Vercel | `production` | set | `browser` (`window.speechSynthesis`) | `TURSO_PROD_*` |

`TTS_MODE` in `.env.local`/the platform's env settings overrides the auto-detection in
either direction on any target. There is no `vercel.json` in this repo and none is needed —
Next.js is zero-config on Vercel, and the only thing that would ever warrant one (a build
command override, function memory/duration tuning) isn't needed here: `maxDuration` is
already set per-route via Next's own route-segment config (`/api/speak`, `/api/transcribe`),
and Vercel picks that up natively.

**Why three different TTS-mode/DB combinations instead of one config**: Piper needs a
**persistent process** kept alive across requests — true on a normal server (local dev,
Render) but not on Vercel's serverless functions, where each request may hit a different,
short-lived instance with no shared process state. SQLite (the original DB) had the same
problem in reverse (needs a persistent *file*), which is why the DB moved to Turso first —
a network database has no persistent-process/file requirement either way, so it didn't need
a second mode; TTS did, because there's no equivalent "just make Piper a network service"
move without hosting Piper somewhere separately (not done — browser TTS was simpler and
free).

## Known limitations / honest state of each feature

**Static interview practice (`/interviews`)** — Functionally complete and mature.
Recording → transcription → feedback → advance-to-next-question all work end-to-end.
Completed 10-question sessions are now saved for logged-in users (Phase 1); standalone
single-question practice (outside a session) is still never persisted, by design — the
save API and `SessionRunner` wiring only cover the multi-question session flow.

**Live AI conversations (`/live`)** — Functionally complete, now with 10 roleplay
scenarios per category (50 total) instead of 1–2. Specific risk areas, unchanged from
before Phase 3:
- VAD thresholds (`HandsFreeRecorder.js`) are first-pass estimates, explicitly marked as
  needing real-world tuning. The new mic-level meter makes the current sensitivity visible
  but doesn't change the underlying thresholds.
- In `"piper"` mode, Piper is a single local process shared across all concurrent users of
  the dev/prod server (no per-request or per-user isolation); the `MAX_PENDING` queue cap
  (10) is a backstop, not real concurrency. In `"browser"` mode (Vercel) this doesn't apply
  — synthesis happens independently in each visitor's own browser.
- `[leak-check]`/`[speak-check]` console instrumentation is now silenced in production
  builds (Phase 4) but still fires in dev, same as before.

**Customer Care Bible (`/vocabulary`)** — Unchanged: simple, complete for what it does, no
audio/pronunciation, no search/filter, no progress tracking.

**Accounts & saved progress (`/anmelden`, `/registrieren`, `/fortschritt`)** — New in
Phase 1. Specific limitations:
- **No password-reset flow.** There is no email service in this project, so a forgotten
  password currently has no recovery path at all — this is a real gap for a production
  release, not just a nice-to-have. Adding one requires picking an email provider (even a
  transactional one like Resend/Postmark) and is a meaningful scope addition, not a small
  patch.
- **No email verification.** Registration immediately creates and logs into the account
  with whatever email string was submitted; nothing confirms the address is real or owned
  by the registrant.
- **Auth.js (next-auth) v5 is still a beta release** (`5.0.0-beta.31` at the time of
  writing), not a stable 5.0.0. It was chosen over the stable v4 line because v4's App
  Router support is a bolt-on and v5 is the maintainers' actively-developed path forward;
  its `peerDependencies` explicitly declare support for Next.js `^16.0.0`. Re-check this
  before assuming a newer stable release isn't available.
- **No rate limiting on `/api/register` or the credentials sign-in flow** — nothing stops
  scripted account-creation or credential-stuffing attempts beyond what Auth.js does by
  default (which is not much for a Credentials provider).
- **Turso has no schema migration tooling** — `CREATE TABLE IF NOT EXISTS` at module load is
  fine for the current three-table schema, but changing a column later means a manual
  `ALTER TABLE` by hand (or an ORM migration adopted later); there's no Prisma/Drizzle-style
  migration story in place yet. (This used to be a local SQLite file — that's no longer
  true; see "Deployment" above for why it moved.)
- **No account deletion, email change, or password change UI.** Once created, a user's
  only self-service action is signing in/out.
- **`Mein Fortschritt` has no pagination.** Every saved session/conversation for a user is
  fetched and rendered on one page load; fine at hobby scale, would need pagination or a
  date range filter under real usage growth.

**Cross-cutting**
- **No tests.** Still true — no test runner configured, no test files anywhere.
- **No TypeScript / static type checking.** Still true.
- **LLM provider is explicitly temporary.** `app/api/feedback/route.js` and
  `app/api/conversation-feedback/route.js` still explicitly mark Groq's free Llama 3.3 as a
  temporary, cost-driven stand-in for Claude/Anthropic — see the comments in both files.
  `ANTHROPIC_API_KEY` still exists in `.env.local` as an unused placeholder for that future
  swap.
- **Piper path defaults are platform-specific** (`C:\piper` on Windows, `vendor/piper` on
  Linux), overridable via `PIPER_DIR` on either — this is intentional now (see "Deployment"
  above), not an oversight.
- **Env var validation covers the active TTS mode's actual needs**: `checkPiperInstall()`
  (called from `instrumentation.js`, only when `getTtsMode() === "piper"`) validates the
  resolved Piper binary/model exist on disk, so a missing/misconfigured Piper install
  surfaces as a startup warning, not just a runtime error the first time `/api/speak` is
  called. There is no equivalent check for browser mode — `window.speechSynthesis` support
  can't be checked server-side, and `speakBrowser()` already degrades gracefully (a clear
  error message + moving the conversation on) if a visitor's browser lacks it or has zero
  voices.
- **`lang="de"` is now correct** on `<html>` in `app/layout.js` (was `"en"`, fixed in Phase 3).
- **Deployment configuration exists now** (see "Deployment" above) — Render (Piper, Linux
  binary auto-downloaded at build time) and Vercel (browser TTS, zero-config Next.js
  detection, no `vercel.json`) are both real, working targets, not aspirational. `next.config.mjs`
  is still the default empty config — nothing in it needed to change for either target.

## For an AI reviewing this repo

- Don't assume standard/current Next.js conventions — check `AGENTS.md` and
  `node_modules/next/dist/docs/` first, per the project's own instructions. In particular,
  `middleware.js` is deprecated in favor of `proxy.js` as of v16 — if you're adding route
  protection, that's the file name to use, not `middleware.js`.
- The `referenceAnswer` field in `scenarios.js` is the "model answer" shown before
  recording (opt-in reveal); `modelAnswer` returned from the feedback APIs is a *different*,
  freshly-generated example tailored to what the trainee actually said. Don't conflate them.
- If asked to change the feedback LLM provider, `/api/feedback`, `/api/conversation`, and
  `/api/conversation-feedback` all need the same fetch-call change (see their comments) —
  Groq was a deliberate, temporary, cost-driven choice, not an oversight. All three (plus
  `/api/transcribe`) already share `getGroqApiKey()` from `lib/env.js` for the key itself.
- If asked to fix the VAD, treat the named constants at the top of
  `HandsFreeRecorder.js` as the tuning surface — they are already isolated for exactly that
  purpose. The mic-bars meter added in Phase 3 reads the same `rms` value already computed
  there; it doesn't introduce a second amplitude-measurement path.
- If asked to add password reset or email verification, there is currently zero email
  infrastructure in this project — that's a new dependency (a transactional email
  provider), not a small addition to existing code.
- Auth checks are done ad hoc via `auth()` calls in Server Components/Route Handlers, not
  via a central `proxy.js`. This is intentional — nothing in the app is gated behind login
  — but if a future feature *does* need hard gating, a `proxy.js` doing an optimistic
  cookie check (per the Next.js auth guide pattern) would be the idiomatic place, not a
  scattering of manual redirects.

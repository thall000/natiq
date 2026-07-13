# Natiq — Project Context (for AI tools and reviewers)

This file exists so an AI tool (or a human) reading this repo cold — with no memory of
prior conversations about it — can get accurate, complete context in one pass. It
describes what actually exists in the code as of this writing, not the intended end state.
If something below looks wrong, trust the code over this file and update this file.

## What this project is

Natiq helps people (primarily in Egypt) prepare for German-language customer service job
interviews and calls. It is a Next.js app with no backend database, no user accounts, and
no persistence between sessions — everything lives in React component state for the
duration of a single browser session.

**Read `AGENTS.md` before making changes.** This repo intentionally pins a Next.js version
that is not the Next.js most training data or tooling assumes — check
`node_modules/next/dist/docs/` for the actual current API surface before writing code that
assumes familiar Next.js conventions.

## Architecture at a glance

- **Framework**: Next.js 16.2.10, App Router only (no Pages Router), plain JavaScript (no
  TypeScript — `jsconfig.json` only sets up the `@/*` path alias, there is no build-time
  type checking anywhere in this project).
- **UI**: Server Components for static/data-driven pages, Client Components (`"use client"`)
  for anything interactive (recording, playback, live conversation state machines).
  Styling is hand-written inline `style={}` objects plus a shared `app/globals.css` for
  theme variables (`--accent`, `--muted`, `--surface-accent`, etc.) and a few reusable
  classes (`.card`, `.btn`, `.page`, `.vocab-*`). No CSS framework, no component library.
- **Data**: All interview content lives in two static JS modules, imported directly by
  pages — there is no CMS, no database, no API-backed content:
  - `app/scenarios.js` — categories + interview/roleplay scenarios (~2500 lines).
  - `app/vocabulary.js` + `app/vocabulary-translations.js` — the Customer Care Bible content.
- **External services**: Groq API (LLM + Whisper transcription) and a local Piper TTS
  process. No other third-party services. No Anthropic/Claude calls currently happen at
  runtime despite `ANTHROPIC_API_KEY` existing as an env var slot (see "Known limitations").
- **Auth/persistence**: None. No login, no saved history, no database. Refreshing the page
  loses all in-progress state (transcript, feedback, conversation history).

## Routes

### Pages (`app/**/page.js`)

| Route | Type | Purpose |
|---|---|---|
| `/` | Server | Landing page: hero, "how it works" steps, category grid, audience blurb. |
| `/interviews` | Server | Lists all 5 categories with scenario counts. |
| `/interviews/[category]` | Server (`generateStaticParams`) | Lists all scenarios in a category; entry point to either browse one question or start a 10-question session. |
| `/interviews/[category]/[id]` | Server (`generateStaticParams`) | A single scenario: prompt + `RecordingPanel`. |
| `/interviews/[category]/session` | Server, `dynamic = "force-dynamic"` | Picks 10 random non-roleplay scenarios for the category and renders `SessionRunner`. Forced dynamic because the random selection must not be cached/pre-rendered. |
| `/live` | Server | Lists categories for the live-conversation feature. |
| `/live/[category]` | Server, `dynamic = "force-dynamic"` | Picks one random roleplay scenario for the category (`getRandomRoleplayByCategory`) and renders `LiveConversation`. Forced dynamic for the same reason as `/session`. |
| `/vocabulary` | Client (`"use client"`) | Customer Care Bible — renders all vocabulary sections, with click-to-toggle translation popovers. |

### API routes (`app/api/**/route.js`) — all server-only, all `POST`

| Route | Calls | Purpose |
|---|---|---|
| `/api/transcribe` | Groq `whisper-large-v3` | Accepts a `multipart/form-data` audio blob, returns `{ transcript }`. Uses a fixed German vocabulary-biasing prompt (customer-service terms) to reduce mis-transcription of domain words. `maxDuration = 30`. |
| `/api/feedback` | Groq `llama-3.3-70b-versatile` | Grades a single transcript against a scenario prompt. Returns `{ feedback: { assessment, grammarMistakes[], naturalPhrasing[], contentIdeas[], modelAnswer } }` (no `score` field — see naming inconsistency below). |
| `/api/conversation` | Groq `llama-3.3-70b-versatile` | Drives the AI customer's next line in a live roleplay, given `{ scenarioPrompt, messages }`. Returns `{ line }`. System prompt explicitly instructs the model to extract only the customer's situation/mood from the scenario text (which was originally written as instructions *to the trainee*) and never break character or act as the employee. |
| `/api/conversation-feedback` | Groq `llama-3.3-70b-versatile` | Grades a full conversation transcript at once, once the trainee ends the call. Returns `{ feedback: { score, scoreJustification, assessment, grammarMistakes[], naturalPhrasing[], contentIdeas[], modelAnswer } }`. Clamps `score` to an integer 1–10 or drops it if the model returns something unusable. |
| `/api/speak` | Local Piper process (`piperClient.js`) | Accepts `{ text }`, returns a `audio/wav` binary response synthesized by Piper. `maxDuration = 30`. |

**Naming inconsistency to be aware of:** `/api/feedback` (single answer) does *not* return a
`score`, only `/api/conversation-feedback` (full conversation) does, even though both use
almost the same system prompt structure and both render through the same
`FeedbackDisplay` component (which conditionally shows the score block only if
`feedback.score` is a number). This looks intentional in the single-answer case — grading a
30-second answer numerically might feel arbitrary — but is worth confirming before
assuming it's a bug.

## Key components

- **`app/components/CategoryCard.js`** — Category tile; renders differently based on a
  `featured` prop (all 5 current categories have `ready: true` in `scenarios.js`, so the
  "In Vorbereitung" / non-featured / greyed-out visual state is currently unused code
  but stays as a designed extension point if new categories are added not-yet-ready.
- **`app/components/FeedbackDisplay.js`** — Shared renderer for both feedback shapes
  (`/api/feedback` and `/api/conversation-feedback`); all fields are optional/conditionally
  rendered so it degrades gracefully if a field is missing.
- **`app/interviews/[category]/RecordingPanel.js`** (Client) — The core single-question
  practice loop: mic capture via `MediaRecorder` → `/api/transcribe` → optional
  `/api/feedback` → display. Used both standalone (`[id]/page.js`) and inside
  `SessionRunner` (via `onAdvance`/`advanceLabel`/`onTranscriptReady` props that change its
  behavior when embedded in a multi-question session).
- **`app/interviews/[category]/session/SessionRunner.js`** (Client) — Steps through 10
  scenarios client-side by index; no persistence, so refreshing mid-session restarts it
  from question 1 with the *same* originally-fetched random set (the set is passed in as a
  prop from the server component, not re-randomized).
- **`app/live/[category]/LiveConversation.js`** (Client) — The live roleplay state machine
  (`PHASE.INTRO → AI_LOADING → AI_SPEAKING → USER_TURN → ... → ENDING → ENDED`). Owns a
  single `getUserMedia` stream + `AudioContext` for the *entire* conversation (created once
  on "Gespräch starten", torn down on end/unmount) and passes it down to
  `HandsFreeRecorder` rather than letting each turn acquire its own — this was a deliberate
  fix for mount/unmount races under React Strict Mode's dev-only double-invoke behavior
  (see the comments in both files). Also does **sentence-level streaming TTS**: it splits
  the AI's reply into sentences and synthesizes/plays them one at a time, prefetching the
  next sentence's audio while the current one plays, so playback starts before the whole
  reply has been synthesized.
- **`app/live/[category]/HandsFreeRecorder.js`** (Client) — Voice Activity Detection (VAD)
  for hands-free turn-taking, implemented from scratch with the Web Audio API (`AnalyserNode`
  RMS energy), not a library. Two-level silence detection: a short *segment* silence
  (~600ms) closes and restarts the current recording segment (handles natural pauses
  mid-sentence without ending the turn), while a longer *turn* silence (~1200ms, tracked
  independently of segment boundaries) ends the whole turn. Includes ambient-noise
  calibration (500ms sampling window per turn) so the speech threshold adapts to the room,
  a safety timeout, and a max recording length failsafe. All timing constants are declared
  at the top of the file as named constants with comments flagging them as
  **"adjust after real-world testing"** — i.e., current values are reasonable first guesses,
  not validated against real usage data yet.
- **`app/api/speak/piperClient.js`** — Manages a single long-lived `piper.exe` child
  process per Node process (not per-request), communicating over stdin/stdout with
  `--json-input`. Deliberately cached on `globalThis` (`globalThis.__piperState`) rather
  than module scope, specifically to survive Turbopack's dev-mode hot-reload, which
  resets normal module-scope state but not `globalThis`. Handles crash/respawn with a
  cooldown, a FIFO queue matching stdout lines back to pending requests in order, and
  polls output files until their size stabilizes (Piper announces a file's path on stdout
  before it's finished writing it, confirmed by direct testing per the code comment).

## Content inventory

- **5 categories**, all currently `ready: true`: Telekommunikation, Einzelhandel, Reise &
  Tourismus, Gastgewerbe, Autovermietung.
- **205 scenarios total** across those categories (roughly 40 per category), of which
  **6 are roleplay scenarios** (`kind: "Rollenspiel"`, one or two per category, used by the
  live-conversation feature) and the rest are standard interview questions (`kind:
  "Interviewfrage"`) tagged with a `type` (`standard`, `technical`, `curveball`, `stress`,
  `rapid-follow-up`, `ethical`) and a `difficulty` (`easy`/`medium`/`hard`). Every
  interview-question scenario includes a `referenceAnswer` (native-speaker model answer);
  roleplay scenarios do not (the AI generates the customer's lines live instead).
- The Customer Care Bible (`app/vocabulary.js`) is organized into sections with `nomen`,
  `verben`, `adjektive`, and `phrasen` arrays; `app/vocabulary-translations.js` maps each
  word/phrase string to `{ en, ar }` translations looked up by exact string match.

## Known limitations / honest state of each feature

**Static interview practice (`/interviews`)** — Functionally complete and is the most
mature feature. Recording → transcription → feedback → advance-to-next-question all work
end-to-end. No progress is saved: closing the tab loses everything, and there's no way to
review past sessions or track improvement over time.

**Live AI conversations (`/live`)** — Functionally complete but the newest and least
battle-tested feature. Specific risk areas:
- VAD thresholds (`HandsFreeRecorder.js`) are first-pass estimates, explicitly marked as
  needing real-world tuning. Expect false turn-endings in noisy environments, or
  false continuations if someone pauses mid-sentence for close to 1.2s.
- The whole conversation depends on one persistent mic stream/`AudioContext`; if that setup
  ever throws mid-conversation there's no automatic recovery path — the user has to end and
  restart.
- Piper is a single local process shared across all concurrent users of the dev/prod
  server (there is no per-request or per-user isolation) — the `MAX_PENDING` queue cap
  (10) exists specifically as a backstop against this becoming unbounded, but under real
  concurrent load requests will simply queue and wait, not run in parallel.
- Extensive `console.log` instrumentation prefixed `[leak-check]` and `[speak-check]`
  throughout `LiveConversation.js` — left in deliberately per the surrounding comments (for
  diagnosing mic-leak and audio-overlap issues), not dead debug code, but it does mean
  production console output is currently noisy.

**Customer Care Bible (`/vocabulary`)** — Simple and complete for what it does (static
reference content with translations). No audio/pronunciation, no search/filter, no
progress tracking (e.g., no "mark as learned").

**Cross-cutting limitations:**
- **No tests.** There is no test runner configured in `package.json` and no test files
  anywhere in the repo. Nothing here is verified except by manual use.
- **No TypeScript / static type checking.** Bugs like the feedback shape mismatch above
  would not be caught by tooling.
- **LLM provider is explicitly temporary.** Both `app/api/feedback/route.js` and
  `app/api/conversation-feedback/route.js` have comments stating the choice of Groq's free
  Llama 3.3 (instead of Claude/Anthropic) is **TEMPORARY**, chosen to avoid Anthropic API
  costs while testing/designing, with an explicit note that swapping back to Claude later
  is meant to be an isolated one-line-fetch change. `ANTHROPIC_API_KEY` exists in
  `.env.local` as an empty placeholder for this future swap but is not read by any code
  yet — grep for `ANTHROPIC` in `app/` to confirm before assuming otherwise.
  Practical implication: feedback quality, JSON-schema adherence, and rate limits are all
  bounded by Groq's free tier today, not by Anthropic's models.
- **Piper path is Windows-specific and machine-specific by default.** `PIPER_DIR` defaults
  to the literal `C:\piper`, hardcoded in `piperClient.js`. It's overridable via the
  `PIPER_DIR` env var, but out of the box this only works on the original developer's
  Windows machine with Piper installed at that exact path. Piper itself and the voice model
  are not vendored in the repo (by design — they're large binaries) and live entirely
  outside version control.
- **No error resilience beyond the basics.** API routes return a generic `502` with
  whatever error text the upstream (Groq or Piper) gave; there's no retry/backoff logic for
  rate limiting anywhere except the client-side VAD's transcription-retry loop
  (`RETRY_DELAY_MS` in `HandsFreeRecorder.js`).
- **No environment variable validation.** If `GROQ_API_KEY` is missing or invalid, requests
  fail with whatever error Groq returns, surfaced as a generic "transcription/feedback
  failed" message client-side — there's no startup check or clearer error message pointing
  at the missing env var.
- **Accessibility/SEO gaps.** `app/layout.js` sets `lang="en"` on `<html>` even though
  essentially all visible content is German — worth fixing if this ships publicly.
- **No deployment configuration.** `next.config.mjs` is the default empty config; there's
  no Vercel/Docker/CI config in the repo. Piper's local-process dependency also means a
  standard serverless deployment (e.g., Vercel) would not support `/live` as-is without
  rearchitecting TTS to a hosted service or a persistent server.

## For an AI reviewing this repo

- Don't assume standard/current Next.js conventions — check `AGENTS.md` and
  `node_modules/next/dist/docs/` first, per the project's own instructions.
- The `referenceAnswer` field in `scenarios.js` is the "model answer" shown before
  recording (opt-in reveal); `modelAnswer` returned from the feedback APIs is a *different*,
  freshly-generated example tailored to what the trainee actually said. Don't conflate them.
- If asked to change the feedback LLM provider, both `/api/feedback` and
  `/api/conversation-feedback` need the same fetch-call change (see their comments) — Groq
  was a deliberate, temporary, cost-driven choice, not an oversight.
- If asked to fix the VAD, treat the named constants at the top of
  `HandsFreeRecorder.js` as the tuning surface — they are already isolated for exactly that
  purpose.

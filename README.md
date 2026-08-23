# Mercury

A general-purpose AI assistant with a dedicated **Code** subject, built on top of a **deterministic math engine**. Ask it anything, the way you would ChatGPT or Claude; when a question touches arithmetic, an equation, a derivative, or a statistic, the language model decides *which* computation to run and calls an exact symbolic tool for it rather than doing the arithmetic itself. Every such answer is verified before it reaches you.

The platform is subject-based: **Chat** (general) and **Code** ship today, and a third subject (Science, research, whatever) can be added without touching the shared infrastructure.

---

## Deploying without a computer

See **[DEPLOY.md](DEPLOY.md)** — a phone-only path using GitHub's web upload,
an included unpack workflow, and Vercel. No terminal required.

## Quick start (on a computer)

```bash
npm install
cp .env.example .env.local     # add your GROQ_API_KEY
npm run dev                    # http://localhost:3000
```

Get a free API key at https://console.groq.com/keys.

If the key is missing, the app loads and tells you exactly what to fix rather than failing silently.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm test` | Unit suite (96 tests, no network or API key needed) |
| `npm run test:e2e` | End-to-end browser test of the real UI (see below) |
| `npm run typecheck` | TypeScript across the whole project |
| `npm run typecheck:lib` | Strict check of the dependency-free core |
| `npm run typecheck:ui` | Strict check of the React/UI layer |
| `npm run verify` | Static checks: unresolved imports, secret leakage, Next conventions |
| `npm run check` | test + typecheck:lib + verify |

---

## End-to-end testing

`npm run test:e2e` launches the real UI in Chromium against the real API routes,
the real streaming agent loop, and the real math engine, then asserts 51 checks:
every math scenario below, exporting a conversation to PDF or Markdown,
searching conversation history, jumping back to the latest message while
scrolled up, an offline banner that disables the composer, streaming and stop,
conversation create/rename/delete, persistence across reload, theme switching,
error display, and that no secret reaches the client bundle.

By default the **language model** — and only the language model — is replaced by
`scripts/mock-upstream.mjs`, a local server speaking the Groq/OpenAI SSE wire
format. It never invents math: it requests a real tool call and builds its reply
from the values the engine returns, so every number asserted in the browser came
from the engine. With a key present, `node scripts/e2e.mjs --live` runs the same
suite against the real model.

`scripts/dev-harness.mjs` serves the app (esbuild bundle + Tailwind + the real
route handlers) for environments where `next dev` is unavailable. Production
runs on Next.js; the harness is a test tool.

Playwright drives the browser and is installed on demand rather than declared
as a dependency, so it never lands in a production build:

```bash
npm install --no-save playwright && npx playwright install chromium
```

On a machine that already has a Chromium, point
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` at it and skip the download.

## Dependencies

Four runtime packages: `next`, `react`, `react-dom`, `katex`.

Markdown rendering and icons are local code (`src/lib/markdown/parser.ts`,
`src/components/icons.tsx`) rather than libraries. The parser is a pure function
with its own test suite, and it handles the delimiter styles models actually
emit (`$…$`, `$$…$$`, `\(…\)`, `\[…\]`) while keeping LaTeX away from
markdown rules — so `a_1 * b_2` inside math is never mangled into subscripts and
emphasis, and `$5 and then $10` stays a pair of prices.

## Why this isn't a thin wrapper

Language models are unreliable at arithmetic and confidently wrong in ways that are hard to catch by reading the prose. The fix here is architectural: a **zero-dependency exact math engine** in `src/lib/subjects/math/engine/`, exposed to the Chat subject's model as 15 tools. (The Code subject has no tools of its own -- see "Subjects" below.)

- **Exact rational arithmetic on BigInt.** `0.1 + 0.2` is `3/10`, not `0.30000000000000004`.
- **Exact vs. approximate is tracked through every operation.** `sqrt(16)` returns exactly `4`; `sqrt(2)` is flagged irrational and can never be presented as exact. This flag propagates: one irrational input makes the whole result approximate, and the system prompt forbids showing an approximation as an exact answer.
- **Every solution is substituted back and verified** before it is returned.
- **Derivatives are cross-checked** against a numerical finite difference.
- **Definite integrals** are computed symbolically *and* by adaptive Simpson quadrature, then compared.
- **`check_work` walks a person's working line by line** and finds the *first* line that stops following from the one before it, with a counterexample -- so "did I do this right?" gets a real diagnosis instead of the model guessing.

If a tool cannot solve something, it says so. The prompt instructs the model to report that rather than invent an answer.

### Capabilities

Arithmetic · fractions · decimals · percentages · ratios and proportions · order of operations · negative numbers · exponents · roots · pre-algebra · algebra · linear equations · systems · inequalities · polynomials · factoring · functions · geometry · coordinate geometry · trigonometry · statistics · probability · word problems · graphs · precalculus · calculus · introductory college math.

### Tools available to the model

`calculate` · `solve_equation` · `solve_system` · `solve_inequality` · `simplify_expression` · `factor_polynomial` · `differentiate` · `integrate` · `limit` · `statistics` · `probability` · `matrix` · `check_equivalent` · `check_work` · `plot_function`

---

## Subjects

| Subject | id | Tools | What it's for |
| --- | --- | --- | --- |
| **Chat** | `general` | The 15 math tools | A normal AI assistant. Ask anything; math and calculations are verified rather than produced from memory. |
| **Code** | `code` | None | Writing, debugging, reviewing, and explaining code. |

Each subject has exactly one mode, so the mode-switching UI (`Composer.tsx`) hides itself -- there is nothing to switch between within a subject. Switching *subjects*, in the sidebar, resumes the most recent conversation already in that subject or starts a fresh one; each conversation belongs to a single subject for its whole life.

---

## Architecture

```
src/
├── app/
│   ├── api/chat/       Streaming chat endpoint (SSE)
│   ├── api/subjects/   Subject + mode metadata, drives the whole UI
│   ├── api/title/      Auto-naming for conversations
│   ├── api/health/     Configuration check
│   ├── api/diag/       Self-diagnosis: key, model ID, tool-calling support
│   └── page.tsx
├── components/         ChatApp, Sidebar, MessageList, Composer, MarkdownMath, ToolTrace
├── hooks/              useChat (streaming, stop, regenerate), useTheme
└── lib/
    ├── core/           SUBJECT-AGNOSTIC PLATFORM
    │   ├── ai/client   Groq chat completions over fetch (no SDK)
    │   ├── ai/agent    Tool-calling loop → stream events
    │   ├── registry    Subject registration
    │   ├── memory      Context trimming, follow-up resolution
    │   ├── validate    Request validation
    │   ├── ratelimit   Token bucket behind a store interface
    │   ├── auth        Identity, ready for a real AuthAdapter
    │   ├── errors      Typed errors → user-facing messages
    │   └── sse         Event encoding/parsing
    └── subjects/
        ├── index.ts    Registration happens here
        ├── math/       the "Chat" subject: modes · prompt · tools · engine/
        └── code/       the "Code" subject: modes · prompt (no tools)
```

**Everything in `src/lib/` has zero runtime dependencies.** That is why the entire server path — engine, agent loop, tool dispatch, validation, rate limiting, memory — is unit-tested without mocks of our own logic. React and Next.js appear only at the UI edge.

### Security

- `GROQ_API_KEY` is read **only** in `src/lib/core/env.ts`, only on the server. `npm run verify` fails the build if that is ever violated or if a client file references a server env var.
- No `NEXT_PUBLIC_` secret exists. The browser talks to `/api/chat`; only the server talks to Groq.
- Request validation runs before any upstream call: message counts, per-message and total length, image MIME types, and a 5MB image cap.
- Rate limiting buckets anonymous clients by request origin rather than by cookie, so dropping the cookie does not reset the limit. Swap `MemoryRateLimitStore` for Redis in production.

---

## Token budget

Every tool schema is re-sent on each call of the agent loop, and one verified
answer costs at least two calls: one to choose the tool, one to explain the
result. All fifteen schemas together run about 2400 tokens, which is
enough on a small per-minute quota to exhaust the budget before the explanation
can start.

So `src/lib/subjects/math/select.ts` advertises only the tools a question could
plausibly need — about 500 tokens instead of 2400. Descriptions are never
shortened: they are what teach the model when to reach for exact computation
instead of doing arithmetic in its head.

Narrowing is an optimisation, never a restriction. `runAgent` dispatches
against the subject's full tool list, so a model that names a tool outside the
selection still gets a real execution. There is a test that pins exactly this.

`AI_MAX_TOOL_ITERATIONS` is capped at what that budget affords, so the agent
does not spend a call it will only be refused for.

`AI_MAX_TOKENS` is the other half: providers commonly bill the reservation
against the quota even when the reply is shorter, so raising it buys longer
answers and costs tool round-trips.

---

## Vision (photo uploads)

The default model is text-only, so a request carrying an uploaded photo is
routed to a separate vision-capable model instead (`GROQ_VISION_MODEL`,
default `meta-llama/llama-4-scout-17b-16e-instruct`) -- chosen for supporting
both image input and the tool calling the math engine depends on; most vision
models drop tool calling, which would let the model do arithmetic on the photo
itself instead of the verified engine. The decision is based on what
`buildContext` actually kept in the request, not the raw upload, since memory
strips images from every turn except the most recent couple.

## Export as PDF

The export button in the header is `window.print()` behind a styled print
stylesheet (`@media print` in `globals.css`) -- there is no PDF library and
nothing to keep in sync with the chat UI. It hides the sidebar and composer,
lets the message list flow across pages instead of scrolling inside a fixed
height, and forces light colours regardless of the app's theme (dark mode's
palette is a set of CSS custom properties, not a media query, so ".dark" alone
survives into print and would put light text on the unprinted white page).

## Installable (PWA)

`public/manifest.json` plus the icons and `appleWebApp` metadata in
`layout.tsx` make "Add to Home Screen" open as a standalone app -- own icon
and window chrome, no browser address bar -- on both Android and iOS.

## Convenience features

- **Search** (`Sidebar.tsx`) appears once there are more than a handful of
  conversations. It matches title or message content, so "the one about
  circles" finds a conversation whose title never says "circle."
- **Copy as Markdown** (`lib/client/markdown-export.ts`) is the plain-text
  sibling of PDF export -- for pasting into notes or a homework doc rather
  than producing a page. Never includes image data, only an image count.
- **Jump to latest** (`MessageList.tsx`) appears once you scroll away from the
  bottom during a live answer, so following along doesn't require staying
  glued to the newest line.
- **Offline banner** (`hooks/useOnlineStatus.ts`) disables the composer and
  says so, rather than letting a send fail into a generic network error.

## When answers stop working

Open `/api/diag` on the deployment. It runs the pipeline server-side and names
the failing step — no key, rejected key, a model ID Groq has retired, or a model
that cannot call tools — without ever printing the key.

Two invariants are worth stating because breaking either produces a blank chat
rather than an error:

- **`/api/chat` must return an SSE stream.** The browser reads it with an
  incremental SSE parser, so a route that returns plain JSON on the success path
  renders as an empty reply.
- **The agent loop must receive the subject's tools.** Without them the model
  does its own arithmetic and nothing is verified, which is the failure mode this
  project exists to prevent.

---

## Adding a new subject

The registry is the seam. To add Science:

1. Create `src/lib/subjects/science/` with `index.ts`, `modes.ts`, `prompt.ts`, `tools.ts`, mirroring `math/`.
2. Export a `SubjectModule`.
3. Add it to `SUBJECT_MODULES` in `src/lib/subjects/index.ts`.

That is the whole change. API routes, streaming, tool execution, memory, validation, rate limiting, and the entire UI read from the registry — the new subject appears in the sidebar with its own modes, tools, suggestions, and system prompt.

Subjects marked `status: 'coming-soon'` render as locked in the sidebar and are rejected by the chat route.

---

## Memory

The assistant keeps the thread of a conversation. `buildContext` trims old turns to a character budget while always keeping recent ones, strips images from older messages first (they dominate payload size), and never starts a transcript on an assistant turn.

It also extracts the **current topic** and detects follow-ups. So this works:

```
You:        2x + 5 = 15
Assistant:  ... subtract 5 from both sides ...
You:        why did you subtract 5?
```

The system prompt carries `Current topic: 2x + 5 = 15` plus a note that a follow-up question refers to the previous explanation -- so "5" resolves without repeating the problem. This is covered by a test.

Conversations persist in `localStorage` behind a `ConversationStore` interface; implement that interface against your API to add accounts and cross-device history.

---

## Testing

```
npm test        # 96 tests
```

- `engine-core` — rational arithmetic, parsing, LaTeX normalization, exact/approximate tracking, linear/quadratic/cubic solving, systems, inequalities
- `engine-advanced` — simplification, calculus with verification, statistics, matrices, work-checking, plotting
- `platform` — validation, rate limiting, auth, memory, SSE, registry, and the **full agent loop against a mocked transport with real tools executing**
- `scenarios` — the cases the assistant must get right: arithmetic, algebra, word problems, multi-step chains, a wrong solution someone worked through, follow-ups, hard calculus, approximation honesty, graceful failure
- `markdown` — the markdown/math parser: delimiter handling, currency, nesting, streaming-safe partial input
- `client-export` — the Markdown export: readable formatting, images noted by count only, never by data
- `routes` — API handlers called directly: validation, missing key, rate limit headers, vision-model routing

No network or API key is required; the model transport is mocked, but the math engine under test is the real one.

```
npm run test:e2e   # 55 browser checks against the running app
```

---

## Known limits

- Symbolic integration covers polynomials, `1/x`, exponentials, and trig composed with linear inner functions. Anything else falls back to numerical quadrature and is labelled approximate — deliberately, rather than guessing a closed form.
- Non-polynomial equations are solved numerically on `[-50, 50]`; roots outside that window are not found, and the tool says so.
- Limits are evaluated numerically. The value is reported with a note to confirm algebraically.
- Complex roots are detected and reported as "no real solutions" but not computed.
- `localStorage` history is per-device and strips images to stay inside quota.

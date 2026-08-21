# MathMind

An AI math tutor built on a **deterministic computation engine**. The language model decides *which* computation to run and how to explain it; it never does the arithmetic itself. Every solution, derivative, statistic, and equivalence claim is verified by exact symbolic code before it reaches the student.

Math is the first module of a subject-based platform. Science, History, and English can be added without touching the shared infrastructure.

---

## Deploying without a computer

See **[DEPLOY.md](DEPLOY.md)** — a phone-only path using GitHub's web upload,
an included unpack workflow, and Vercel. No terminal required.

## Quick start (on a computer)

```bash
npm install
cp .env.example .env.local     # add your ANTHROPIC_API_KEY
npm run dev                    # http://localhost:3000
```

Get an API key at https://console.anthropic.com/settings/keys.

If the key is missing, the app loads and tells you exactly what to fix rather than failing silently.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm test` | Unit suite (78 tests, no network or API key needed) |
| `npm run test:e2e` | End-to-end browser test of the real UI (see below) |
| `npm run typecheck` | TypeScript across the whole project |
| `npm run typecheck:lib` | Strict check of the dependency-free core |
| `npm run typecheck:ui` | Strict check of the React/UI layer |
| `npm run verify` | Static checks: unresolved imports, secret leakage, Next conventions |
| `npm run check` | test + typecheck:lib + verify |

---

## End-to-end testing

`npm run test:e2e` launches the real UI in Chromium against the real API routes,
the real streaming agent loop, and the real math engine, then asserts 35 checks:
every math scenario below, streaming and stop, conversation create/rename/delete,
persistence across reload, theme switching, error display, and that no secret
reaches the client bundle.

By default the **language model** — and only the language model — is replaced by
`scripts/mock-upstream.mjs`, a local server speaking the Anthropic SSE wire
format. It never invents math: it requests a real tool call and builds its reply
from the values the engine returns, so every number asserted in the browser came
from the engine. With a key present, `node scripts/e2e.mjs --live` runs the same
suite against the real model.

`scripts/dev-harness.mjs` serves the app (esbuild bundle + Tailwind + the real
route handlers) for environments where `next dev` is unavailable. Production
runs on Next.js; the harness is a test tool.

## Dependencies

Four runtime packages: `next`, `react`, `react-dom`, `katex`.

Markdown rendering and icons are local code (`src/lib/markdown/parser.ts`,
`src/components/icons.tsx`) rather than libraries. The parser is a pure function
with its own test suite, and it handles the delimiter styles models actually
emit (`$…$`, `$$…$$`, `\(…\)`, `\[…\]`) while keeping LaTeX away from
markdown rules — so `a_1 * b_2` inside math is never mangled into subscripts and
emphasis, and `$5 and then $10` stays a pair of prices.

## Why this isn't a thin wrapper

Language models are unreliable at arithmetic and confidently wrong in ways that are pedagogically toxic. The fix here is architectural: a **zero-dependency exact math engine** in `src/lib/subjects/math/engine/`, exposed to the model as 15 tools.

- **Exact rational arithmetic on BigInt.** `0.1 + 0.2` is `3/10`, not `0.30000000000000004`.
- **Exact vs. approximate is tracked through every operation.** `sqrt(16)` returns exactly `4`; `sqrt(2)` is flagged irrational and can never be presented as exact. This flag propagates: one irrational input makes the whole result approximate, and the system prompt forbids showing an approximation as an exact answer.
- **Every solution is substituted back and verified** before it is returned.
- **Derivatives are cross-checked** against a numerical finite difference.
- **Definite integrals** are computed symbolically *and* by adaptive Simpson quadrature, then compared.
- **`check_work` walks a student's lines** and finds the *first* line that stops following from the previous one, with a counterexample. That is what makes "Check My Work" a real diagnosis instead of the model guessing.

If a tool cannot solve something, it says so. The prompt instructs the model to report that rather than invent an answer.

### Capabilities

Arithmetic · fractions · decimals · percentages · ratios and proportions · order of operations · negative numbers · exponents · roots · pre-algebra · algebra · linear equations · systems · inequalities · polynomials · factoring · functions · geometry · coordinate geometry · trigonometry · statistics · probability · word problems · graphs · precalculus · calculus · introductory college math.

### Tools available to the model

`calculate` · `solve_equation` · `solve_system` · `solve_inequality` · `simplify_expression` · `factor_polynomial` · `differentiate` · `integrate` · `limit` · `statistics` · `probability` · `matrix` · `check_equivalent` · `check_work` · `plot_function`

---

## Modes

| Mode | Behaviour |
| --- | --- |
| **Solve** | Complete worked solution; every step justified, answer verified |
| **Learn** | Teaches the concept from the ground up, ending with a comprehension check |
| **Hint** | Exactly one hint, then stops. Never reveals the answer |
| **Practice** | Generates problems, solving each with tools first so they are well-posed |
| **Check My Work** | Finds the first wrong line and names the misconception |
| **Explain** | Plain-language explanation of a concept |

Explanation level (Auto / Elementary / Middle / High / College) changes vocabulary and step granularity. Auto infers the level from the problem and the student's own wording.

---

## Architecture

```
src/
├── app/
│   ├── api/chat/       Streaming chat endpoint (SSE)
│   ├── api/subjects/   Subject + mode metadata, drives the whole UI
│   ├── api/title/      Auto-naming for conversations
│   ├── api/health/     Configuration check
│   └── page.tsx
├── components/         ChatApp, Sidebar, MessageList, Composer, MarkdownMath, ToolTrace
├── hooks/              useChat (streaming, stop, regenerate), useTheme
└── lib/
    ├── core/           SUBJECT-AGNOSTIC PLATFORM
    │   ├── ai/client   Anthropic Messages API over fetch (no SDK)
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
        └── math/       modes · prompt · tools · engine/
```

**Everything in `src/lib/` has zero runtime dependencies.** That is why the entire server path — engine, agent loop, tool dispatch, validation, rate limiting, memory — is unit-tested without mocks of our own logic. React and Next.js appear only at the UI edge.

### Security

- `ANTHROPIC_API_KEY` is read **only** in `src/lib/core/env.ts`, only on the server. `npm run verify` fails the build if that is ever violated or if a client file references a server env var.
- No `NEXT_PUBLIC_` secret exists. The browser talks to `/api/chat`; only the server talks to Anthropic.
- Request validation runs before any upstream call: message counts, per-message and total length, image MIME types, and a 5MB image cap.
- Rate limiting buckets anonymous clients by request origin rather than by cookie, so dropping the cookie does not reset the limit. Swap `MemoryRateLimitStore` for Redis in production.

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

The tutor keeps the thread of a session. `buildContext` trims old turns to a character budget while always keeping recent ones, strips images from older messages first (they dominate payload size), and never starts a transcript on an assistant turn.

It also extracts the **active problem** and detects follow-ups. So this works:

```
Student:  2x + 5 = 15
Tutor:    ... subtract 5 from both sides ...
Student:  why did you subtract 5?
```

The system prompt carries `Current problem: 2x + 5 = 15` plus a note that the student is asking about the previous explanation — so "5" resolves without the student repeating themselves. This is covered by a test.

Conversations persist in `localStorage` behind a `ConversationStore` interface; implement that interface against your API to add accounts and cross-device history.

---

## Testing

```
npm test        # 63 tests
```

- `engine-core` — rational arithmetic, parsing, LaTeX normalization, exact/approximate tracking, linear/quadratic/cubic solving, systems, inequalities
- `engine-advanced` — simplification, calculus with verification, statistics, matrices, work-checking, plotting
- `platform` — validation, rate limiting, auth, memory, SSE, registry, and the **full agent loop against a mocked transport with real tools executing**
- `scenarios` — the cases a tutor must get right: arithmetic, algebra, word problems, multi-step chains, a student's wrong solution, follow-ups, hard calculus, approximation honesty, graceful failure
- `markdown` — the markdown/math parser: delimiter handling, currency, nesting, streaming-safe partial input
- `routes` — API handlers called directly: validation, missing key, rate limit headers

No network or API key is required; the model transport is mocked, but the math engine under test is the real one.

```
npm run test:e2e   # 35 browser checks against the running app
```

---

## Known limits

- Symbolic integration covers polynomials, `1/x`, exponentials, and trig composed with linear inner functions. Anything else falls back to numerical quadrature and is labelled approximate — deliberately, rather than guessing a closed form.
- Non-polynomial equations are solved numerically on `[-50, 50]`; roots outside that window are not found, and the tool says so.
- Limits are evaluated numerically. The value is reported with a note to confirm algebraically.
- Complex roots are detected and reported as "no real solutions" but not computed.
- `localStorage` history is per-device and strips images to stay inside quota.

# ARCHITECTURE.md — SpotRealRedFlag (as built)

This is the **technical** companion to `PROJECT_CONTEXT.md`. `PROJECT_CONTEXT.md`
describes the product and its intent; this file describes how the current code is
actually wired, so a new contributor (human or AI) can get oriented quickly.

Last verified against the codebase: 2026-09-10.

---

## 1. What the app is (one paragraph)

SpotRealRedFlag is a mobile-first PWA. A user uploads a ride-booking screenshot (or
types a vehicle plate), the app looks up community-submitted reports for that vehicle
in a Supabase/Postgres database, and shows one of three states — **green** (no
reports), **amber** (some reports), **red** (multiple reports across several
categories). Anyone can also submit an anonymous report. There is no login. Full
product rationale, tone, and safety-language rules are in `PROJECT_CONTEXT.md` — read
that before changing user-facing copy or the risk logic.

---

## 2. Stack & tooling

| Concern      | Choice                                                            |
|--------------|-----------------------------------------------------------------------|
| Build tool   | **Vite 5** (`vite.config.ts`) — see §8 for the intended vs current stack |
| UI           | **React 18** + **TypeScript 5**                                      |
| Styling      | **Tailwind CSS 3** (`tailwind.config.js`) + hand-written classes in `src/index.css` |
| Icons        | `lucide-react` only                                                  |
| DB client    | `@supabase/supabase-js` v2                                           |
| Origin       | Exported from **bolt.new** — see `.bolt/`, `README.md` badge (`sb1-rdjy6x5z`) |
| Hosting      | Not yet deployed (intended: Vercel)                                  |

### npm scripts

| Script              | Purpose                                  |
|---------------------|------------------------------------------|
| `npm run dev`       | Vite dev server                          |
| `npm run build`     | Production build to `dist/`              |
| `npm run preview`   | Serve the built `dist/`                  |
| `npm run lint`      | ESLint (`eslint.config.js`, flat config) |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.app.json`      |

### Path alias

`@/` → `src/` (configured in **both** `vite.config.ts` and `tsconfig.app.json`).
Use `@/lib/data` rather than `../lib/data`. This convention comes from `.bolt/prompt`.

---

## 3. Runtime flow

```
index.html  ->  src/main.tsx  ->  src/App.tsx (mounts <App/> in StrictMode)
```

`src/App.tsx` is the **entire UI in one file**. It is a small screen state machine:

```ts
type Screen = 'home' | 'check' | 'analyzing' | 'result' | 'reports' | 'report' | 'cantRead';
```

`App` holds all shared state (`useState`) and renders exactly one screen component at a
time based on `screen`. Key shared state:

- `vehicleNumber` — the plate string, shared by the check flow, the reports search, and
  the report form (defaults to `"KA 01 AB 1234"`). Set from the AI extraction result on
  a successful screenshot read.
- `checkResult: VehicleCheckResult | null` — the last lookup result.
- `cantRead: CantReadInfo | null` — why the `cantRead` screen is showing
  (`low_confidence` vs `error`).
- `selectedCategories`, `submitted`, `submitting`, `submitError` — report-form state.

### Screens

| `screen`      | Component          | What it does / data call                                                       |
|---------------|--------------------|-------------------------------------------------------------------------------|
| `home`        | `Home`             | Hero + upload affordance + "how it works" + "something happened?" entry. Drop-zone file pick → `analyzeScreenshot`; buttons → `check`. |
| `check`       | `CheckRide`        | Upload UI + manual plate entry. File pick → `analyzeScreenshot`; "Check vehicle" → `runManualCheck`. |
| `analyzing`   | `Analyzing`        | Purely visual loading state shown while extraction + `checkVehicle()` run.      |
| `cantRead`    | `CantRead`         | Shown when extraction returns `low_confidence` or `error`. "Upload another screenshot" / "Enter vehicle number manually". Never proceeds to a lookup. |
| `result`      | `Result`           | Renders green/amber/red from `checkResult.resultKind`; safety-note copy varies by state. |
| `reports`     | `CommunityReports` | Calls `getCommunityReports(vehicle.id)` in a `useEffect`; lists anonymised reports. |
| `report`      | `ReportRide` / `Submitted` | Report form → `submitReport(...)`; on success swaps to the `Submitted` confirmation. |

Other components in the file: `Header`, `BottomNav`, `FooterLinks`.

### Screenshot upload flow (Phase 3)

`handleFile` reads the picked `File` and calls `analyzeScreenshot(file)`:

1. `setScreen('analyzing')`
2. `extractRideDetails(file)` from `@/lib/ai` (see §4a) — currently the **mock**
   provider, no SDK, no network.
3. `status: 'success'` → set `vehicleNumber` to the read plate, then
   `lookupAndShow()` → `checkVehicle()` → `result`.
4. `status: 'low_confidence'` or `'error'` → `setScreen('cantRead')`. The app **never**
   runs a database lookup on an unread / low-confidence plate
   (`PROJECT_CONTEXT.md` §12, §14).

The image is passed straight to the provider and never uploaded or stored (§18).

---

## 4. Data layer — `src/lib/`

All database access lives in `src/lib/data.ts`. Components never call `supabase`
directly except `App.tsx` importing these three functions:

| Function                                   | Reads / writes                                                                 |
|--------------------------------------------|------------------------------------------------------------------------------|
| `checkVehicle(registrationNumber)`         | Normalises the plate; `SELECT` `vehicles` by `normalized_registration_number`; if found, `SELECT` its `active` `reports`; **always** `INSERT` a row into `searches`. Returns `{ vehicle, reports, resultKind, reportCount }`. |
| `getCommunityReports(vehicleId)`           | `SELECT` `active` `reports` for a vehicle, newest first; maps each to a `CommunityReportView` (first category, "Month YYYY" date, description as quote, platform). |
| `submitReport({ registrationNumber, platform, categories, description, rideDate })` | Finds or `INSERT`s the `vehicles` row, then `INSERT`s a `reports` row. Returns `{ success, error? }`. |

### The result rule (deterministic — no AI)

In `checkVehicle`:

```
distinctCategories = unique categories across all active reports
reportCount >= 3 AND distinctCategories >= 2   -> 'red'
reportCount >= 1                               -> 'caution'
otherwise                                      -> 'clear'
```

`PROJECT_CONTEXT.md` §10 says the eventual risk engine should also weigh severity,
recency, duplication, and independence — but the classification must stay deterministic
app logic. If you change this rule, update `supabase/seed.sql` (its header documents the
same rule) and this table.

### Plate normalisation — `src/lib/normalize.ts`

`normalizeRegistration(input)` = remove all whitespace + uppercase. Both `checkVehicle`
and `submitReport` store the raw string in `registration_number` and the normalised
string in `normalized_registration_number`. Matching is **exact on the normalised
value** — no fuzzy matching (`PROJECT_CONTEXT.md` §14).

### Types — `src/lib/types.ts`

`Vehicle`, `Report`, `ResultKind` (`'clear' | 'caution' | 'red'`),
`VehicleCheckResult`, `CommunityReportView`. These are hand-written to match the DB
columns; there is no generated Supabase types file yet.

---

## 4a. AI provider abstraction — `src/lib/ai/`

Per `PROJECT_CONTEXT.md` §11, §13, §32: AI returns **structured** data; the app makes
the deterministic decisions; providers are swappable behind one interface.

| File                | Contents                                                                 |
|---------------------|------------------------------------------------------------------------|
| `types.ts`          | `AIProvider` interface, `ExtractedRideDetails` (all fields nullable + per-field `confidence` 0..1), `ScreenshotInput`, `ExtractionOutcome` (`success` \| `low_confidence` \| `error`). |
| `mockProvider.ts`   | `mockProvider: AIProvider` — **no SDK, no network**. Returns canned structured data after a ~1.2 s delay, keyed off the picked file's **name** (table below). Used for local dev (`VITE_AI_PROVIDER=mock`, the default). |
| `geminiProvider.ts` | `geminiProvider: AIProvider` — `File` → base64 → `POST` to the `extract-ride-details` Supabase Edge Function (which holds the Gemini key). No secret in this file or the bundle. Active when `VITE_AI_PROVIDER=gemini`. |
| `index.ts`          | `getAIProvider()` (reads `VITE_AI_PROVIDER`, default `"mock"`), `extractRideDetails(file)` (calls the provider, then applies the confidence gate), `VEHICLE_NUMBER_CONFIDENCE_THRESHOLD = 0.8`. |

**Confidence gate** (`extractRideDetails` in `index.ts` — provider-agnostic, unchanged
by Gemini): the outcome is `success` only if `vehicleNumber` is non-empty **and**
`confidence.vehicleNumber >= 0.8`. Otherwise `low_confidence`. A thrown provider error
becomes `error`. Both branches route the UI to the `cantRead` screen and **never** run
a DB lookup (`PROJECT_CONTEXT.md` §12, §14).

**Mock file-name triggers** (for local testing):

| File name contains                        | Result                          |
|------------------------------------------|---------------------------------|
| `blur` / `lowconf` / `unclear` / `unreadable` / `fail` | `low_confidence` (number = null) |
| `clear`                                   | reads `KA 05 MN 7788` → green   |
| `caution`                                 | reads `KA 03 CD 4567` → amber   |
| anything else                             | reads `KA 01 AB 1234` → red     |

The three "good" plates match `supabase/seed.sql`, so an upload produces a real
green / amber / red result end to end.

### The Gemini path (`VITE_AI_PROVIDER=gemini`)

```
browser: geminiProvider  ──POST {imageBase64, mimeType}──▶  Edge Function
                                                              extract-ride-details
                                                              (GEMINI_API_KEY secret)
                                                                     │
                                                              Gemini generateContent
                                                              (responseSchema = structured)
                                                                     │
browser ◀──── ExtractedRideDetails JSON ─────────────────────────────┘
   │
   └─ confidence gate (index.ts) → success | low_confidence | error
```

- Function code: `supabase/functions/extract-ride-details/` — `index.ts` (Deno HTTP
  server, CORS, env, fetch) + `gemini.ts` (pure prompt / schema / response-mapping,
  unit-tested by `scripts/test-lib.mjs`).
- Model is `GEMINI_MODEL` (default `gemini-2.0-flash`) — cheap, fast, good OCR, JSON
  mode. Swap without code changes.
- Prompt forbids guessing: an illegible plate → `vehicle_number: null`; the mapper
  also forces `confidence.vehicleNumber = 0` whenever the number is null.
- No auth (`--no-verify-jwt`); the browser still sends the anon key as `apikey`.
- The screenshot is never stored — it exists only for the request (`§18`).
- Deploy + secrets: see `DEPLOYMENT.md`.

**Not implemented yet:** `classifyReport` (Phase 4) and `moderateContent` (Phase 5)
are named in `PROJECT_CONTEXT.md` §32 but not on the `AIProvider` interface yet.

---

## 5. Database

Migrations (run in order, in the Supabase SQL Editor — each has an authoritative
top comment):

1. `supabase/migrations/20260910053117_create_spotrealredflag_schema.sql` — core tables.
2. `supabase/migrations/20260910073537_spam_safeguards.sql` — `client_key` columns +
   `reports` CHECK constraints + indexes (see §5a).

Seed data for testing: `supabase/seed.sql`.

| Table             | Purpose                                    | Key columns                                                                 |
|-------------------|--------------------------------------------|---------------------------------------------------------------------------|
| `vehicles`        | One row per distinct vehicle               | `registration_number` (raw), `normalized_registration_number` (**unique**) |
| `reports`         | Community-submitted reports                | `vehicle_id` FK, `platform`, `categories text[]`, `description`, `ride_date`, `status` (default `'active'`), `client_key` |
| `report_evidence` | Optional evidence files (schema only, unused by the app yet) | `report_id` FK, `storage_path`, `expires_at` (retention) |
| `searches`        | Audit log of every check (analytics / abuse detection) | `vehicle_id` FK (nullable), `search_term` (raw), `platform`, `client_key` |

- IDs are `uuid` via `gen_random_uuid()` (needs the `pgcrypto` extension — the
  migration enables it).
- No `ON DELETE CASCADE` anywhere — intentional, we never want silent data loss.
- No `user_id` columns anywhere — there is no auth in the MVP.

### Row Level Security

RLS is **ON** for all four tables. Every table has exactly two policies, both
`TO anon, authenticated`:

- `public_select_*` — `USING (true)` (anyone can read)
- `public_insert_*` — `WITH CHECK (true)` (anyone can insert)

There are **no** UPDATE or DELETE policies — reports cannot be edited or removed
through the API. Future moderation would flip `reports.status` server-side (e.g. an
Edge Function or the service-role key), never from the browser.

---

## 5a. Spam / abuse safeguards (lightweight, pre-launch)

Migration `20260910073537_spam_safeguards.sql` + `src/lib/data.ts` +
`src/lib/reportValidation.ts` + `src/lib/clientKey.ts`. No new infrastructure.

| Safeguard              | Where enforced                                     | Rule |
|------------------------|----------------------------------------------------|------|
| Min description length | JS (`reportValidation.ts`) + DB `CHECK`            | trimmed `description` ≥ 20 chars |
| No contact info        | JS (`reportValidation.ts`) + DB `CHECK`            | reject Indian mobile numbers, 10+ digit runs (spaces/hyphens ignored), email addresses |
| Report rate limit      | JS (`data.ts`, `COUNT` on `reports`)               | ≤ 3 reports per `client_key` per 60 min |
| Duplicate report       | JS (`data.ts`)                                     | same `vehicle_id` + same description text within 24 h is rejected |

- `client_key` — a random id in `localStorage` (`src/lib/clientKey.ts`). **Not auth**,
  no PII (`PROJECT_CONTEXT.md` §4). Written to `reports.client_key` and
  `searches.client_key`.
- The DB `CHECK` constraints are the unbypassable backstop (a client hitting PostgREST
  directly still can't insert a phone number or a 5-char description). The JS checks
  just produce a friendly message first; `submitReport` also maps a constraint
  violation back to a readable error.
- Rate-limit / dedupe thresholds are the tunable part and live in `data.ts` constants.

---

## 6. Environment variables

### Frontend (`VITE_*` — safe in the browser bundle)

| Variable                 | Read in                | Notes                                          |
|--------------------------|------------------------|-----------------------------------------------|
| `VITE_SUPABASE_URL`      | `src/lib/supabase.ts`, `src/lib/ai/geminiProvider.ts` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.ts`, `src/lib/ai/geminiProvider.ts` | anon **public** key |
| `VITE_AI_PROVIDER`       | `src/lib/ai/index.ts`  | `"mock"` (default) or `"gemini"` |

### Server (Supabase Edge Function secrets — **never** `VITE_`, never in the bundle)

| Secret           | Used by                                  | Notes                          |
|------------------|------------------------------------------|--------------------------------|
| `GEMINI_API_KEY` | `supabase/functions/extract-ride-details` | from Google AI Studio          |
| `GEMINI_MODEL`   | same (optional)                          | default `gemini-2.0-flash`      |

- Vite only exposes vars prefixed `VITE_` to client code, via `import.meta.env`.
  Types for these are declared in `src/vite-env.d.ts`.
- `src/lib/supabase.ts` throws a clear, named error at startup if either is missing
  (rather than white-screening).
- `.env` lives at the repo root, is **git-ignored** (`.gitignore` already lists `.env`
  and `*.local`), and is created by copying `.env.example`. Restart `npm run dev` after
  editing it.
- **Why shipping the anon key in the browser is fine:** it is not a secret. RLS (§5) is
  the real access boundary. The anon key only lets a client do what the RLS policies
  already allow any anonymous visitor to do (read all rows, insert reports/searches).
  The **service-role key must never** be put in this project or any `VITE_` var.

### Setup / deploy

Local dev: `npm install`, `cp .env.example .env` (fill in Supabase URL + anon key,
leave `VITE_AI_PROVIDER=mock`), `npm run dev`.

Applying migrations, deploying the Edge Function + secrets, going to `gemini`, and
deploying the frontend to Vercel: **see `DEPLOYMENT.md`** (the full runbook, with the
exact Vercel env vars and Supabase secrets to set).

`supabase/config.toml` exists (project ref + `verify_jwt = false` for the function).
`supabase` CLI is a devDependency — use `npx supabase ...`. No Docker-based local
stack; migrations are applied via the SQL Editor or `npx supabase db push`.

---

## 7. Not built yet (maps to `PROJECT_CONTEXT.md` phases)

| Area                                  | Status                                                      | Phase |
|---------------------------------------|------------------------------------------------------------|-------|
| Supabase wired to real data           | **Done** — `src/lib/data.ts` is fully Supabase-backed       | 2     |
| AI provider abstraction + upload flow  | **Done** — `src/lib/ai/` + `analyzeScreenshot`, `cantRead` low-confidence branch | 3 |
| Real Gemini extraction                 | **Done (code)** — `geminiProvider` + `extract-ride-details` Edge Function; needs deploy + `GEMINI_API_KEY` secret + `VITE_AI_PROVIDER=gemini` (`DEPLOYMENT.md`) | 3 |
| Lightweight spam / abuse safeguards    | **Done** — see §5a. Full abuse system (scoring, bot detection) still later | 5 |
| AI report categorisation              | Not started — categories are user-selected checkboxes       | 4     |
| Evidence upload UI + Storage + retention | Not started — `report_evidence` table exists, no UI, "Add screenshot" button is inert | 5–6 |
| Informational pages (Safety/Privacy/Terms/How it works) | Placeholder buttons in `FooterLinks` / `Header`, no routes | 6 |
| PWA polish (service worker, offline)  | `public/manifest.json` exists; no service worker registered | 6     |
| Auth                                  | **Intentionally never** for the MVP (`PROJECT_CONTEXT.md` §4) | —   |

---

## 8. Intended stack vs current stack

`PROJECT_CONTEXT.md` (§21 "Current tech stack", §35 "Immediate development goal")
specifies **Next.js + TypeScript + Tailwind**, hosted on **Vercel**.

The repository as it stands is a **Vite + React + TypeScript** app exported from
**bolt.new** — not Next.js. This is a known gap. **The plan is to migrate to Next.js at
a later point**; for now the app runs on Vite.

What is Vite-specific and will change in a Next.js migration:

- `vite.config.ts`, `index.html` as the HTML entry, `src/main.tsx` bootstrap — replaced
  by Next's `app/` (or `pages/`) structure and its own entry handling.
- `import.meta.env.VITE_*` env access → `process.env.NEXT_PUBLIC_*` (and the typing in
  `src/vite-env.d.ts` / `.env.example` key names change accordingly).
- `@/` alias would move to `tsconfig.json` `paths` / `next.config.js`.
- The single-file `src/App.tsx` screen state machine would become real routes plus
  extracted components; client-only pieces get `"use client"`.
- The Supabase client stays largely the same (`@supabase/supabase-js`), but server
  components / route handlers could use it server-side.

Until that migration happens, treat Vite as the source of truth for build/dev/env
mechanics and `PROJECT_CONTEXT.md` as the source of truth for product decisions.

---

## 9. Tests / local checks

| Command             | What it does                                                                 |
|---------------------|----------------------------------------------------------------------------|
| `npm run typecheck` | `tsc --noEmit` over `src` (not `supabase/functions` — that's Deno).           |
| `npm run lint`      | ESLint over `src` + `scripts` (`supabase/functions` is ignored).             |
| `npm run test:lib`  | Offline unit tests: report content rules (`reportValidation.ts`) + Gemini response mapping (`extract-ride-details/gemini.ts`). Bundles the TS with esbuild, asserts, exits non-zero on failure. |
| `npm run test:gemini` | `GEMINI_API_KEY=… npm run test:gemini -- path/to/shot.png` — live call to the real Gemini API with the function's exact prompt/schema; prints the mapped result + whether the gate passes. No deploy needed. |
| `npm run screenshot`| Playwright (`channel: 'chrome'` — installed Chrome, no bundled browser) drives the running app at 390 px and screenshots each state into `./screenshots/` (git-ignored). Fails on any console/page error. |

`npm run screenshot` prereq: `npm run dev` on `http://localhost:5173` (override with
`APP_URL`). Path it walks: Home → upload `scripts/fixtures/ride.png` → red result →
"Check another ride" → upload `scripts/fixtures/blur.png` → `cantRead` screen → "Enter
vehicle number manually" → type `KA 03 CD 4567` → amber. Fixtures are 1×1 PNGs; the
mock provider keys off their file names (§4a).

> Against a DB where migration 2 (`spam_safeguards`) isn't applied yet, `npm run
> screenshot` reports two console `400`s (the `searches.client_key` insert) — expected
> until the migration runs, then clean.

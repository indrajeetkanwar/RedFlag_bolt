# DEPLOYMENT.md — SpotRealRedFlag going live

Takes the app from "mock AI, local only" to **real Gemini extraction + real DB +
deployed frontend**. Read `ARCHITECTURE.md` §4a, §5, §5a, §6 for how the pieces fit.

All code is in the repo. The steps below are the ones that need **your** Supabase /
Vercel / Google credentials — they can't be done from the codebase alone.

Project ref: `yojnyfsatgevqbdjmmqm`

---

## 0. Prerequisites

- Repo cloned, `npm install` run.
- Supabase project (already exists).
- A **Vercel** account.
- A **Gemini API key** — https://aistudio.google.com/apikey (this is separate from any
  consumer Gemini subscription; the free tier is fine to start).
- `npx supabase` works (the `supabase` CLI is a devDependency). For Edge Function
  deploy you need `npx supabase login` once (opens a browser for an access token).

---

## 1. Apply the database migrations

Both files in `supabase/migrations/`, **in order**. Either method:

**SQL Editor (simplest):** Supabase dashboard → SQL Editor → paste each file's contents
→ Run.

1. `20260910053117_create_spotrealredflag_schema.sql` (idempotent, re-run safe)
2. `20260910073537_spam_safeguards.sql` (spam safeguards)
3. `20260910082139_report_ai_classification.sql` (Phase 4 `reports.ai_*` columns)
4. `20260910110828_drop_searches_public_select.sql` — drop `searches` public SELECT
5. `20260910110829_ai_calls_rate_limit.sql` — `ai_calls` table for the function rate limit
6. `20260910110830_public_reports_view.sql` — `public_reports` view

Run **all six in order**. 1–3 may already be applied; re-running is safe. 4–6 are the
security migrations — required before the Vercel deploy.

**or CLI:**

```bash
npx supabase login
npx supabase link --project-ref yojnyfsatgevqbdjmmqm
npx supabase db push
```

Optional test data: run `supabase/seed.sql` (green/amber/red sample vehicles).

> Until migration 2 is applied, `reports.client_key` / `searches.client_key` don't
> exist: report submission fails and you'll see two `400`s in the browser console on
> each check. Both clear once it's applied.

---

## 2. Deploy the Gemini Edge Functions

Two functions, both public, both using the same secrets:
`extract-ride-details` (Phase 3 — screenshot → plate) and `classify-report`
(Phase 4 — report text → categories).

```bash
# one-time, if not done in step 1
npx supabase login
npx supabase link --project-ref yojnyfsatgevqbdjmmqm

# server-side secrets (NOT VITE_ vars, never in the frontend / Vercel)
npx supabase secrets set GEMINI_API_KEY=your-gemini-key
npx supabase secrets set GEMINI_MODEL=gemini-2.5-flash                    # optional (default)
npx supabase secrets set IP_HASH_SALT=$(openssl rand -hex 32)            # salts the ai_calls IP hash
# ALLOWED_ORIGIN — set AFTER you have the Vercel URL (step 3):
#   npx supabase secrets set ALLOWED_ORIGIN=https://your-app.vercel.app
# Until it's set, only http://localhost:5173 is allowed as a browser Origin.

# deploy both (public — no auth, per PROJECT_CONTEXT.md §4)
npx supabase functions deploy extract-ride-details --no-verify-jwt
npx supabase functions deploy classify-report --no-verify-jwt
```

`supabase/config.toml` already sets `verify_jwt = false` for both. `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are auto-injected into deployed functions — don't set them.

Verify they're up (curl has no `Origin` header, so CORS lets it through; the per-IP
rate limit still applies — 10 calls/hour/function):

```bash
# extraction — 1x1 pixel: expect HTTP 200 with vehicleNumber:null + low confidence
#   (real Gemini call; proves key + model + mapping). A generic 502 = Gemini failed.
curl -s -X POST \
  "https://yojnyfsatgevqbdjmmqm.supabase.co/functions/v1/extract-ride-details" \
  -H "apikey: <your VITE_SUPABASE_ANON_KEY>" -H "Content-Type: application/json" \
  -d "{\"imageBase64\":\"$(base64 -w0 scripts/fixtures/ride.png)\"}"

# a non-image: expect HTTP 400 "doesn't look like a supported image"
curl -s -X POST \
  "https://yojnyfsatgevqbdjmmqm.supabase.co/functions/v1/extract-ride-details" \
  -H "apikey: <anon>" -H "Content-Type: application/json" \
  -d '{"imageBase64":"aGVsbG8gd29ybGQgdGhpcyBpcyBub3QgYW4gaW1hZ2U="}'

# classification — expect HTTP 200 with categories / severity / confidence
curl -s -X POST \
  "https://yojnyfsatgevqbdjmmqm.supabase.co/functions/v1/classify-report" \
  -H "apikey: <anon>" -H "Content-Type: application/json" \
  -d '{"description":"The driver kept shouting and was overtaking dangerously the whole ride."}'
```

All server/Gemini errors now return a generic `"Something went wrong — please try
again."` — check the function logs (`npx supabase functions logs <name>`) for the real
reason. If you get `429` while testing, clear the ledger:
`DELETE FROM ai_calls;` in the SQL Editor.

---

## 3. Point the frontend at Gemini and deploy to Vercel

### 3a. Local smoke test first (optional but recommended)

In `.env` set `VITE_AI_PROVIDER=gemini`, `npm run dev`, upload a **real** ride
screenshot on the Check screen. You should get a real result or the "couldn't clearly
read the vehicle number" screen — never a wrong plate.

### 3b. Deploy

Connect the GitHub repo in the Vercel dashboard (framework auto-detects as **Vite**;
`vercel.json` pins build command / output dir / SPA rewrite), **or**:

```bash
npm i -g vercel
vercel            # first run links the project
vercel --prod
```

### 3c. Vercel environment variables

Dashboard → Project → **Settings → Environment Variables** (Production + Preview):

| Name                     | Value                                                             |
|--------------------------|------------------------------------------------------------------|
| `VITE_SUPABASE_URL`      | `https://yojnyfsatgevqbdjmmqm.supabase.co`                         |
| `VITE_SUPABASE_ANON_KEY` | your anon **public** key (Supabase → Settings → API)               |
| `VITE_AI_PROVIDER`       | `gemini`                                                           |

Redeploy after adding them (Vite inlines env at build time).

> Do **not** put `GEMINI_API_KEY` in Vercel. It only belongs in Supabase secrets.

### 3d. After the first Vercel deploy — lock CORS

Once you have the production URL, set the allowlist secret and redeploy both functions:

```bash
npx supabase secrets set ALLOWED_ORIGIN=https://your-app.vercel.app
npx supabase functions deploy extract-ride-details --no-verify-jwt
npx supabase functions deploy classify-report --no-verify-jwt
```

Until this is set, the deployed site's calls to the functions will be `403`ed
(only `localhost:5173` is allowed). If you use Vercel preview URLs, either add the
specific preview origin too or test previews against `localhost`.

---

## 4. Env / secret reference (summary)

**Vercel** (frontend, build-time):

```
VITE_SUPABASE_URL       = https://yojnyfsatgevqbdjmmqm.supabase.co
VITE_SUPABASE_ANON_KEY  = <anon public key>
VITE_AI_PROVIDER        = gemini
```

**Supabase secrets** (`npx supabase secrets set ...`, server-side only):

```
GEMINI_API_KEY  = <from Google AI Studio>
GEMINI_MODEL    = gemini-2.5-flash                  (optional, this is the default)
IP_HASH_SALT    = <openssl rand -hex 32>            (salts the ai_calls IP hash)
ALLOWED_ORIGIN  = https://your-app.vercel.app       (set in step 3d, after deploy)
```

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — never set them.

---

## 5. Testing that real extraction works

1. **Prompt / mapping, no deploy needed:**
   `GEMINI_API_KEY=xxx node scripts/test-gemini.mjs path/to/real-screenshot.png`
   Prints the mapped `ExtractedRideDetails` and whether the confidence gate would pass.

2. **Deployed function directly:** the `curl` in step 2, but with a real base64 image
   (`base64 -w0 shot.png`). Expect a 200 with `vehicleNumber` + `confidence`.

3. **Classification (Phase 4), no deploy needed:** the second `curl` in step 2. Or in
   the app, on the report form: type a description → **"Suggest categories from this"**
   → relevant checkboxes get pre-ticked (you can still toggle them).

4. **Full app (Vercel or local with `VITE_AI_PROVIDER=gemini`):**
   - Upload a clear ride screenshot → Analyzing → correct green/amber/red for that plate.
   - Upload a blurry / cropped screenshot → **"We couldn't clearly read the vehicle
     number"** screen, no result. (This is the §12 gate — must never show a guessed plate.)
   - Upload a non-image / a >4 MB image → clear error, no crash.
   - `searches` gets a row per check; `reports` rows have `ai_*` populated.
   - Submit a report with a phone number → rejected with a message.
   - Submit 4 reports quickly → the 4th is rate-limited.
   - >10 screenshot checks in an hour from one network → `429` / "Too many requests".
   - Open the deployed site's dev tools → no CORS errors calling the functions (needs
     `ALLOWED_ORIGIN` set, step 3d).

5. `npm run test:lib` — offline unit tests (content rules + Gemini extraction &
   classification mapping). `npm run screenshot` — drives the mock flow, including the
   "Suggest categories" assist, in real Chrome.

---

## 6. Rollback

- **Frontend:** set `VITE_AI_PROVIDER=mock` in Vercel and redeploy — instantly back to
  the mock provider, no other changes. Or redeploy a previous Vercel deployment.
- **Edge Functions:** `npx supabase functions delete extract-ride-details` /
  `classify-report`. Extraction then returns the `error` outcome → "couldn't read"
  screen; classification silently returns `null` (no suggestion, report still submits).
- **DB:** migrations 2, 3, 5, 6 only *add* things. Migration 4 removed a policy — to
  restore the old (insecure) behaviour: `CREATE POLICY "public_select_searches" ON
  searches FOR SELECT TO anon, authenticated USING (true);`. To undo content rules:
  `ALTER TABLE reports DROP CONSTRAINT reports_description_min_length, DROP CONSTRAINT
  reports_description_no_contact;`.
- **Rate limit too aggressive:** raise `RATE_LIMIT_PER_HOUR` in
  `supabase/functions/_shared/security.ts` and redeploy, or `DELETE FROM ai_calls;`.

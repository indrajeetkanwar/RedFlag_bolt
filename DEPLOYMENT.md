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

1. `20260910053117_create_spotrealredflag_schema.sql` (already applied on this project —
   re-running is safe, it's idempotent)
2. `20260910073537_spam_safeguards.sql` ← **new, must be run**

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

## 2. Deploy the Gemini Edge Function

```bash
# one-time, if not done in step 1
npx supabase login
npx supabase link --project-ref yojnyfsatgevqbdjmmqm

# set the server-side secrets (NOT VITE_ vars, never in the frontend)
npx supabase secrets set GEMINI_API_KEY=your-gemini-key
npx supabase secrets set GEMINI_MODEL=gemini-2.0-flash        # optional, this is the default

# deploy (public — no auth, per PROJECT_CONTEXT.md §4)
npx supabase functions deploy extract-ride-details --no-verify-jwt
```

`supabase/config.toml` already sets `verify_jwt = false` for this function, so future
deploys keep it public even without the flag.

Verify it's up:

```bash
curl -i -X POST \
  "https://yojnyfsatgevqbdjmmqm.supabase.co/functions/v1/extract-ride-details" \
  -H "apikey: <your VITE_SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"aGk=","mimeType":"image/png"}'
```

Expect HTTP 502 with `{"error":"Gemini API 400: ...invalid image..."}` — that proves
the function runs and is reaching Gemini with the key. A `500` `"GEMINI_API_KEY is not
configured"` means the secret didn't take.

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
GEMINI_MODEL    = gemini-2.0-flash        (optional)
```

---

## 5. Testing that real extraction works

1. **Prompt / mapping, no deploy needed:**
   `GEMINI_API_KEY=xxx node scripts/test-gemini.mjs path/to/real-screenshot.png`
   Prints the mapped `ExtractedRideDetails` and whether the confidence gate would pass.

2. **Deployed function directly:** the `curl` in step 2, but with a real base64 image
   (`base64 -w0 shot.png`). Expect a 200 with `vehicleNumber` + `confidence`.

3. **Full app (Vercel or local with `VITE_AI_PROVIDER=gemini`):**
   - Upload a clear ride screenshot → Analyzing → correct green/amber/red for that plate.
   - Upload a blurry / cropped screenshot → **"We couldn't clearly read the vehicle
     number"** screen, no result. (This is the §12 gate — must never show a guessed plate.)
   - Check the `searches` table in Supabase for a new row per check.
   - Submit a report with a phone number in the text → rejected with a message.
   - Submit 4 reports quickly → the 4th is rate-limited.

4. `npm run test:lib` — offline unit tests for the content rules and the Gemini
   response mapping. `npm run screenshot` — drives the mock flow in real Chrome.

---

## 6. Rollback

- **Frontend:** set `VITE_AI_PROVIDER=mock` in Vercel and redeploy — instantly back to
  the mock provider, no other changes. Or redeploy a previous Vercel deployment.
- **Edge Function:** `npx supabase functions delete extract-ride-details` (the frontend
  then returns the `error` outcome → "couldn't read" screen).
- **DB:** migration 2 only *adds* columns / constraints / indexes. To undo:
  `ALTER TABLE reports DROP CONSTRAINT reports_description_min_length, DROP CONSTRAINT
  reports_description_no_contact;` (columns can stay — they're nullable and harmless).

/*
# Lightweight spam / abuse safeguards (Phase 5, minimal — pre-launch)

No new infrastructure. Reuses the existing `reports` / `searches` tables.

1. New columns
- `reports.client_key`  (text, nullable) — random id generated once per browser and
  kept in localStorage (NOT auth, no PII). Used only for rate-limiting and dedupe.
- `searches.client_key` (text, nullable) — same, for search-side rate limiting.

2. Server-side content rules on `reports` (CHECK constraints — cannot be bypassed by
   a client calling PostgREST directly, unlike the JS validation in src/lib/data.ts):
- `reports_description_min_length`  — trimmed description must be >= 20 chars.
- `reports_description_no_contact`  — description must not contain an Indian mobile
  number, a run of 10+ digits (trip ids / phone numbers), or an email address.
  POSIX regex (no \d / \s) so it is valid in a CHECK.

3. Indexes to keep the rate-limit / dedupe COUNT queries in src/lib/data.ts cheap.

Notes
- Rate-limit thresholds themselves live in application code (src/lib/data.ts), not
  here — they are expected to be tuned.
- The seed rows in supabase/seed.sql already satisfy both CHECK constraints.
- Existing production rows: none beyond seed; if any row failed the CHECK the
  ALTER would error — intentional, we would want to know.
*/

ALTER TABLE reports ADD COLUMN IF NOT EXISTS client_key text;
ALTER TABLE searches ADD COLUMN IF NOT EXISTS client_key text;

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_description_min_length;
ALTER TABLE reports ADD CONSTRAINT reports_description_min_length
  CHECK (char_length(btrim(description)) >= 20);

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_description_no_contact;
ALTER TABLE reports ADD CONSTRAINT reports_description_no_contact
  CHECK (
    -- phone / long-number checks run on the description with spaces and hyphens
    -- stripped, so "+91 98765 43210" and "98765-43210" are caught too.
    regexp_replace(description, '[[:space:]-]', '', 'g') !~ '(\+?91)?[6-9][0-9]{9}'
    AND regexp_replace(description, '[[:space:]-]', '', 'g') !~ '[0-9]{10,}'
    AND description !~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
  );

CREATE INDEX IF NOT EXISTS reports_client_key_created_at_idx
  ON reports (client_key, created_at DESC);
CREATE INDEX IF NOT EXISTS searches_client_key_created_at_idx
  ON searches (client_key, created_at DESC);

-- Supports the "same vehicle + same text already reported" dedupe check.
CREATE INDEX IF NOT EXISTS reports_vehicle_id_created_at_idx
  ON reports (vehicle_id, created_at DESC);

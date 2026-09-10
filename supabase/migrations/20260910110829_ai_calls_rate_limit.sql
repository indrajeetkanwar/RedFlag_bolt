/*
# Per-IP rate-limit ledger for the AI Edge Functions (security / cost control)

The `extract-ride-details` and `classify-report` functions are public and call a paid
API (Gemini). Without a limit, anyone can drive cost / exhaust quota. Each function now
records one row here per call and refuses (HTTP 429) once an IP has made 10 calls to
that function in the last hour.

- `ip_hash` — SHA-256 of `IP_HASH_SALT : <client IP>`. The raw IP is NEVER stored
  (PROJECT_CONTEXT.md §24). The salt is a Supabase secret so hashes aren't reversible
  over the small IPv4 space.
- No RLS policies: RLS is enabled and there are no `anon` policies, so only the
  service_role key (used by the Edge Functions) can read or write this table.
- Rows are disposable. A periodic cleanup of rows older than a day is a fine
  fast-follow (e.g. `DELETE FROM ai_calls WHERE called_at < now() - interval '1 day'`).
*/

CREATE TABLE IF NOT EXISTS ai_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  function_name text NOT NULL,
  called_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_calls_lookup_idx
  ON ai_calls (ip_hash, function_name, called_at DESC);

ALTER TABLE ai_calls ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: anon/authenticated get nothing; service_role bypasses RLS.

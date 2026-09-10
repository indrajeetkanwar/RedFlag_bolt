/*
# Store AI report categorisation as metadata (Phase 4)

All columns nullable and additive. They do NOT change what the app shows or the
deterministic Green/Amber/Red logic (PROJECT_CONTEXT.md §10) — they are metadata for
future risk-engine and abuse work, and a record of what the model suggested.

- `reports.ai_categories`        text[]   — categories the model suggested (subset of
                                            the fixed taxonomy). May differ from the
                                            user-submitted `categories`.
- `reports.ai_severity`          text     — 'low' | 'medium' | 'high' (or null).
- `reports.ai_confidence`        numeric  — 0..1 overall model confidence.
- `reports.ai_personal_info_flag` boolean — soft signal the text may contain personal
                                            info. Not an enforcement mechanism (that's
                                            the CHECK constraints from migration 2).

The insert in src/lib/data.ts degrades gracefully if these columns are missing, so
applying this migration is not release-blocking — but classification won't be stored
until it runs.
*/

ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_categories text[];
ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_severity text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_confidence numeric;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_personal_info_flag boolean;

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_ai_severity_valid;
ALTER TABLE reports ADD CONSTRAINT reports_ai_severity_valid
  CHECK (ai_severity IS NULL OR ai_severity IN ('low', 'medium', 'high'));

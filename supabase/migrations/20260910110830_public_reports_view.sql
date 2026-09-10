/*
# public_reports view — the safe read surface for community reports (security)

`reports` carries columns the public should not read: `client_key` (a per-browser
fingerprint) and the `ai_*` classification metadata. This view exposes only the
columns the UI needs. `src/lib/data.ts` `getCommunityReports()` reads this view.

`security_invoker = on` so the view respects the caller's role and the RLS on
`reports` (which still has its public SELECT policy) — no privilege escalation, same
rows, fewer columns.

NOTE (residual): the base `reports` table still has `public_select_reports`, because
the client-side report rate-limit query in `data.ts` filters by `client_key`. Fully
hiding those columns from anon means moving report reads/writes server-side (an Edge
Function or a SECURITY DEFINER function) — tracked as a follow-up, not done here.
*/

CREATE OR REPLACE VIEW public_reports
WITH (security_invoker = on) AS
SELECT id, vehicle_id, platform, categories, description, ride_date, created_at, status
FROM reports;

GRANT SELECT ON public_reports TO anon, authenticated;

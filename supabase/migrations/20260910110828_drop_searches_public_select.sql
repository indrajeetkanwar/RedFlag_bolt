/*
# Stop exposing the searches log to the public (security)

The app only ever INSERTs into `searches` (src/lib/data.ts `checkVehicle`); it never
reads it from the client. The `public_select_searches` policy let anyone with the anon
key read every search term + `client_key` + timestamp — a public log of which vehicles
people are checking (PROJECT_CONTEXT.md §24, minimise exposure).

Dropping the SELECT policy leaves RLS on with only the INSERT policy, so the app keeps
working and anon can no longer read the table. Analytics/abuse queries run server-side
(service_role) or in the dashboard.
*/

DROP POLICY IF EXISTS "public_select_searches" ON searches;

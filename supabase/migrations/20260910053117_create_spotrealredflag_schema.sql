/*
# Create SpotRealRedFlag core schema (Phase 2)

1. New Tables
- `vehicles`: stores vehicle registration numbers (raw + normalized).
  - id (uuid, PK, default gen_random_uuid())
  - registration_number (text, not null) — original user-entered format
  - normalized_registration_number (text, not null, unique) — stripped + uppercased
  - created_at (timestamptz, default now())
- `reports`: community-submitted reports linked to a vehicle.
  - id (uuid, PK, default gen_random_uuid())
  - vehicle_id (uuid, references vehicles.id)
  - platform (text, not null) — e.g. Uber, Ola, Rapido, Namma Yatri, Other
  - categories (text[], not null) — one or more category labels
  - description (text, not null) — user-submitted narrative
  - ride_date (date) — when the ride occurred
  - created_at (timestamptz, default now())
  - status (text, default 'active') — active/hidden/removed for future moderation
- `report_evidence`: optional evidence files attached to reports.
  - id (uuid, PK, default gen_random_uuid())
  - report_id (uuid, references reports.id)
  - storage_path (text) — Supabase Storage path
  - created_at (timestamptz, default now())
  - expires_at (timestamptz) — for auto-deletion / retention policy
- `searches`: audit log of vehicle searches for analytics + abuse prevention.
  - id (uuid, PK, default gen_random_uuid())
  - vehicle_id (uuid, references vehicles.id, nullable) — null if no vehicle matched
  - search_term (text, not null) — the raw user-entered term
  - platform (text) — optional platform context
  - created_at (timestamptz, default now())

2. Indexes
- Unique index on `vehicles.normalized_registration_number` — ensures one row per vehicle.

3. Security (RLS)
- This is a NO-AUTH app (Section 4 of PROJECT_CONTEXT.md). All policies use `TO anon, authenticated`.
- `vehicles`: public SELECT, public INSERT (app logic creates vehicles on first search/report). No UPDATE or DELETE.
- `reports`: public SELECT, public INSERT (anyone can submit without login). No UPDATE or DELETE.
- `report_evidence`: public SELECT, public INSERT. No UPDATE or DELETE.
- `searches`: public SELECT, public INSERT. No UPDATE or DELETE.
- No `FOR ALL` policies — each verb has its own policy.

4. Important Notes
- No user_id columns — no authentication in MVP.
- No foreign key ON DELETE CASCADE — we never want data loss.
- `status` column on reports defaults to 'active' for future moderation workflow.
- `expires_at` on report_evidence supports the privacy retention policy (Section 18).
*/

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number text NOT NULL,
  normalized_registration_number text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_normalized_registration_number_key
  ON vehicles (normalized_registration_number);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_vehicles" ON vehicles;
CREATE POLICY "public_select_vehicles" ON vehicles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_vehicles" ON vehicles;
CREATE POLICY "public_insert_vehicles" ON vehicles FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id),
  platform text NOT NULL,
  categories text[] NOT NULL,
  description text NOT NULL,
  ride_date date,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'active'
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_reports" ON reports;
CREATE POLICY "public_select_reports" ON reports FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_reports" ON reports;
CREATE POLICY "public_insert_reports" ON reports FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- report_evidence table
CREATE TABLE IF NOT EXISTS report_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES reports(id),
  storage_path text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE report_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_report_evidence" ON report_evidence;
CREATE POLICY "public_select_report_evidence" ON report_evidence FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_report_evidence" ON report_evidence;
CREATE POLICY "public_insert_report_evidence" ON report_evidence FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- searches table
CREATE TABLE IF NOT EXISTS searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id),
  search_term text NOT NULL,
  platform text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_searches" ON searches;
CREATE POLICY "public_select_searches" ON searches FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_searches" ON searches;
CREATE POLICY "public_insert_searches" ON searches FOR INSERT
  TO anon, authenticated WITH CHECK (true);

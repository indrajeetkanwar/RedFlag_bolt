/*
# SpotRealRedFlag seed data (Phase 2 — local/dev testing)

Run this once in the Supabase SQL Editor AFTER applying
`migrations/20260910053117_create_spotrealredflag_schema.sql`.

It creates three vehicles that exercise every result state in `src/lib/data.ts`:

  Plate (as typed)   Normalized     Reports  Distinct categories  Result
  -----------------  -------------  -------  -------------------  ---------
  KA 05 MN 7788      KA05MN7788     0        -                    clear  (green)
  KA 03 CD 4567      KA03CD4567     2        1                    caution (amber)
  KA 01 AB 1234      KA01AB1234     4        3                    red    (red flag)

Result rule (do not change here — mirror of src/lib/data.ts):
  reportCount >= 3 AND distinctCategories >= 2  -> red
  reportCount >= 1                              -> caution
  otherwise                                     -> clear

Idempotent: vehicles use ON CONFLICT DO NOTHING; report inserts are skipped if the
vehicle already has reports, so re-running does not duplicate rows.
*/

-- 1. Vehicles -----------------------------------------------------------------

INSERT INTO vehicles (registration_number, normalized_registration_number)
VALUES
  ('KA 05 MN 7788', 'KA05MN7788'),
  ('KA 03 CD 4567', 'KA03CD4567'),
  ('KA 01 AB 1234', 'KA01AB1234')
ON CONFLICT (normalized_registration_number) DO NOTHING;

-- 2. Reports for the CAUTION vehicle (KA03CD4567) — 2 reports, 1 category -----

INSERT INTO reports (vehicle_id, platform, categories, description, ride_date)
SELECT v.id, d.platform, d.categories, d.description, d.ride_date
FROM vehicles v
CROSS JOIN (VALUES
  ('Ola',    ARRAY['Route-related concern'],
   'Driver kept taking detours away from the app route and got irritated when I asked about it.',
   DATE '2026-08-14'),
  ('Rapido', ARRAY['Route-related concern'],
   'Took a longer road late at night and would not explain why. Nothing happened but it felt off.',
   DATE '2026-08-27')
) AS d(platform, categories, description, ride_date)
WHERE v.normalized_registration_number = 'KA03CD4567'
  AND NOT EXISTS (SELECT 1 FROM reports r WHERE r.vehicle_id = v.id);

-- 3. Reports for the RED vehicle (KA01AB1234) — 4 reports, 3 categories -------

INSERT INTO reports (vehicle_id, platform, categories, description, ride_date)
SELECT v.id, d.platform, d.categories, d.description, d.ride_date
FROM vehicles v
CROSS JOIN (VALUES
  ('Uber',        ARRAY['Harassment / inappropriate behaviour'],
   'Driver made repeated personal comments about my appearance and asked for my number.',
   DATE '2026-07-02'),
  ('Uber',        ARRAY['Verbal abuse', 'Unsafe driving'],
   'Shouted when I asked him to slow down, was overtaking dangerously the whole ride.',
   DATE '2026-07-19'),
  ('Ola',         ARRAY['Driver followed me'],
   'After dropping me he circled back and parked near my building for a while.',
   DATE '2026-08-05'),
  ('Namma Yatri', ARRAY['Driver contacted me after the ride'],
   'Called and messaged me several times the next day even though I never shared my number in the app.',
   DATE '2026-08-21')
) AS d(platform, categories, description, ride_date)
WHERE v.normalized_registration_number = 'KA01AB1234'
  AND NOT EXISTS (SELECT 1 FROM reports r WHERE r.vehicle_id = v.id);

-- KA05MN7788 intentionally has no reports (clear / green state).

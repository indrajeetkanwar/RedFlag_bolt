You are now the primary AI development partner for the SpotRealRedFlag project.

IMPORTANT:
Before making further changes to the application, read this entire document and understand the product, its purpose, current architecture, decisions already made, future roadmap, and constraints.

This document is the long-term product and technical context for the project.

Keep it updated as the project evolves, but do not change major product decisions without explicitly discussing them with the product owner first.

============================================================
1. WHAT ARE WE BUILDING?
============================================================

We are building SpotRealRedFlag.

SpotRealRedFlag is a mobile-first web application / Progressive Web App designed primarily for women in India.

The core idea:

A woman books a cab or auto through a ride-booking platform such as:

- Uber
- Ola
- Rapido
- Namma Yatri
- other ride platforms

Before getting into the vehicle, she can open SpotRealRedFlag and upload a screenshot of her ride-booking screen.

The application uses AI to identify relevant ride information, especially the vehicle registration number.

The application then checks a community database to determine whether other users have previously submitted reports associated with that vehicle.

The user receives a simple result:

🟢 NO REPORTS FOUND

🟠 REPORTS FOUND / CAUTION

🔴 RED FLAG

The purpose is NOT to declare that a particular driver is objectively safe or dangerous.

The purpose is to give women access to previous community-reported experiences so they can make a more informed decision before entering a vehicle.

The product philosophy is:

"WOMEN LOOKING OUT FOR WOMEN."

One woman's experience can help another woman make a more informed decision.

============================================================
2. THE CORE USER JOURNEY
============================================================

The primary user journey is:

Woman books ride
        ↓
Gets driver/vehicle details
        ↓
Opens SpotRealRedFlag
        ↓
Uploads booking screenshot
        ↓
AI reads screenshot
        ↓
Vehicle registration number identified
        ↓
Database searched
        ↓
Previous community reports found
        ↓
Clear result shown
        ↓
Woman decides what she wants to do

The user must be able to complete the core check extremely quickly.

The application may be used while someone is standing outside a vehicle.

Therefore:

- minimal typing
- large buttons
- clear information
- fast interactions
- no unnecessary navigation
- no unnecessary account creation

are extremely important.

============================================================
3. REPORTING JOURNEY
============================================================

After a ride, a woman can report her experience.

She does NOT need an account.

The flow is:

Report
 ↓
Vehicle registration number
 ↓
Ride platform
 ↓
What happened?
 ↓
Category/categories
 ↓
Description
 ↓
Ride date
 ↓
Optional evidence
 ↓
Submit
 ↓
Immediately added to community database

We deliberately decided that MVP reports should NOT require manual human moderation before becoming available.

The philosophy is:

"Women trusting other women's experiences."

However, automated technical safeguards should still exist against:

- spam
- duplicate submissions
- automated abuse
- excessive submissions
- malicious flooding
- clearly inappropriate content
- attempts to expose unnecessary personal information

These safeguards should be automated rather than dependent on manually reviewing every report.

============================================================
4. NO LOGIN FOR MVP
============================================================

There is NO user authentication in the MVP.

Do not add:

- signup
- login
- password
- email verification
- phone OTP
- social login
- user profiles

A user should be able to:

- check a vehicle
- upload a screenshot
- manually search a vehicle
- submit a report

without creating an account.

The public-facing identity of a report author should be:

"Anonymous report"

or equivalent.

A reporter's identity must never be displayed publicly.

============================================================
5. MOBILE-FIRST PRODUCT
============================================================

This is NOT a desktop website that happens to work on mobile.

It is a mobile-first PWA.

Primary target:

approximately 390px wide smartphone.

It should work well on:

- Android
- iPhone
- tablet
- desktop

The mobile experience has priority.

Eventually we may create native Android/iOS applications, but NOT now.

Do not introduce React Native, Flutter, or separate mobile codebases.

The current web application should be architected cleanly enough that it can eventually serve as the foundation for future mobile applications.

============================================================
6. CURRENT PRODUCT SCREENS
============================================================

The current Stitch design is the visual source of truth.

The current product includes the following major screens:

1. Home
2. Check My Ride / Upload Screenshot
3. Analyzing
4. No Reports Found
5. Reports Found / Caution
6. Red Flag
7. Community Reports
8. Report a Ride
9. Report Submitted
10. Manual Vehicle Search

There are also supporting informational pages/sections such as:

- How it works
- Safety
- Privacy
- Terms

The design should remain:

- modern
- clean
- premium
- mobile-first
- Gen-Z / young-millennial friendly
- conversational
- trustworthy
- slightly playful

It should NOT feel:

- corporate
- governmental
- medical
- like a crime dashboard
- overly feminine
- childish
- fear-based

============================================================
7. BRAND
============================================================

Brand name:

SpotRealRedFlag

The logo is a hand-drawn five-petal flower.

The flower is deep red.

IMPORTANT:

The deep-red flower is the LOGO.

The logo does NOT determine the application's primary UI color.

The general UI should remain neutral.

Current visual direction:

- warm off-white / cream background
- charcoal / near-black typography
- muted indigo/lavender accent for normal interaction
- subtle neutral surfaces
- green for positive/no-report state
- amber for caution
- deep red ONLY when an actual red flag or serious warning is being communicated
- deep red for the logo

Do not turn the entire interface red.

Do not use the logo as a generic icon.

Do not replace the logo with an emoji or generic flower icon.

Use the actual logo asset from the Stitch design whenever available.

============================================================
8. LANGUAGE AND PRODUCT TONE
============================================================

The application should speak like a modern human product.

Examples:

"Before you get in… 👀"

"Let's check that ride."

"Something happened?"

"Tell us what went down."

"Thanks for looking out for the next girl."

The tone can be young and conversational.

However, do NOT overuse slang, memes, jokes, or emojis.

Safety incidents must always be treated seriously.

============================================================
9. CRITICAL SAFETY LANGUAGE
============================================================

This is extremely important.

The application must NOT make definitive claims about an identifiable driver.

Do NOT say:

"This driver is dangerous."

"This driver is safe."

"This driver is guilty."

"This driver committed a crime."

"Confirmed harassment."

"Verified dangerous driver."

Instead use:

"No reports found."

"Community reports."

"Reported concerns."

"Multiple reports have been associated with this vehicle."

"User-submitted report."

"Consider cancelling this ride."

Reports are community-submitted experiences.

They are not independently verified.

The application should clearly communicate:

"Reports are submitted by users and have not been independently verified."

For the green state:

"No reports does not guarantee that a ride is safe. It only means we don't currently have reports associated with this vehicle."

This distinction must remain throughout the product.

============================================================
10. RED / AMBER / GREEN LOGIC
============================================================

There are three user-facing states.

GREEN:

NO REPORTS FOUND

Meaning:

There are currently no reports associated with the vehicle.

It does NOT mean the vehicle is confirmed safe.

AMBER:

REPORTS FOUND

Meaning:

One or more community reports exist.

The user should be able to view the reports and understand the categories.

RED:

RED FLAG

Meaning:

Multiple/significant community reports meet the application's defined threshold for a strong warning.

The red state should recommend caution.

Example:

"Multiple reports have been associated with this vehicle."

"I'd pause before getting in."

"Consider cancelling this ride and booking another vehicle."

Do not create a simplistic rule such as:

"3 reports = dangerous."

The risk engine should eventually consider:

- number of reports
- report categories
- severity
- consistency
- duplicate reports
- independent reports
- recency

But the final classification should be deterministic application logic, not an arbitrary LLM opinion.

============================================================
11. AI PHILOSOPHY
============================================================

AI is a supporting component.

AI should NOT be the final authority on whether a driver is dangerous.

AI should primarily:

1. Understand screenshots.
2. Extract structured ride information.
3. Categorize user-submitted reports.
4. Assist with automated abuse/spam detection.

The application itself should make deterministic decisions.

Conceptually:

Screenshot
 ↓
AI vision
 ↓
Structured vehicle information
 ↓
Database lookup
 ↓
Reports
 ↓
AI categorization where necessary
 ↓
Deterministic safety/risk logic
 ↓
Green / Amber / Red

============================================================
12. SCREENSHOT AI
============================================================

The application will eventually use a Gemini model through the Gemini API.

The developer has access to a Gemini Pro subscription, which can be useful during development/testing, but the consumer Gemini subscription and Gemini API billing/free tier are separate concepts.

Do not assume that a Gemini Pro consumer subscription provides unlimited API usage for the application.

The initial model should prioritize:

- low cost
- image understanding
- reliable OCR/visual extraction
- structured output
- low latency

The initial candidate is a low-cost Gemini vision-capable model.

The exact model should remain configurable so it can be changed without rewriting the application.

IMPORTANT:

The AI must NEVER guess a vehicle registration number.

If the screenshot clearly shows:

KA01AB1234

return:

KA01AB1234

If the AI cannot confidently determine the registration number:

return null / insufficient confidence.

The application should then tell the user:

"We couldn't clearly read the vehicle number."

and offer:

"Upload another screenshot"

or:

"Enter vehicle number manually."

A false vehicle match is potentially much more harmful than failing to identify a vehicle.

============================================================
13. STRUCTURED AI OUTPUT
============================================================

Do not depend on free-form AI prose.

AI should return structured data.

Conceptually:

{
  "platform": "Uber",
  "driver_name": "...",
  "vehicle_number": "KA01AB1234",
  "vehicle_model": "...",
  "vehicle_color": "...",
  "confidence": {
    "platform": 0.99,
    "driver_name": 0.95,
    "vehicle_number": 0.99
  }
}

If uncertain:

{
  "vehicle_number": null,
  "confidence": {
    "vehicle_number": 0.35
  }
}

The actual production schema can evolve.

============================================================
14. VEHICLE IDENTIFICATION
============================================================

The primary identifier is the vehicle registration number.

Normalize registration numbers.

These should be treated as the same:

KA 01 AB 1234
KA01AB1234
ka01ab1234

Internally use a normalized representation.

The application should NOT make uncertain fuzzy matches between similar registration numbers.

Do not assume:

KA01AB1234

is the same as:

KA01AB1284

unless there is an exact normalized match.

============================================================
15. SUPPORTED RIDE PLATFORMS
============================================================

Initial supported platforms:

- Uber
- Ola
- Rapido
- Namma Yatri
- Other

The architecture should make it easy to add additional platforms later.

The screenshot parser should NOT depend entirely on a fixed screen layout because ride apps can change their UI.

The AI should identify information semantically.

============================================================
16. REPORT CATEGORIES
============================================================

Initial categories include:

- Harassment / inappropriate behaviour
- Unsafe driving
- Threatening behaviour
- Driver followed me
- Driver contacted me after the ride
- Verbal abuse
- Route-related concern
- Other

These categories can evolve.

The report form should allow selecting multiple applicable categories when appropriate.

============================================================
17. REPORT CONTENT
============================================================

A report contains approximately:

- vehicle
- platform
- category/categories
- description
- ride date
- optional evidence
- created timestamp
- internal status/metadata

Reports are user-submitted.

The public UI should identify them as anonymous.

Do not expose unnecessary personal information.

Users should be discouraged from including:

- phone numbers
- addresses
- unrelated names
- personal contact information
- unnecessary identifying information

============================================================
18. EVIDENCE / SCREENSHOTS
============================================================

Users may optionally attach evidence to reports.

However, booking screenshots may contain sensitive information such as:

- driver photo
- names
- phone numbers
- trip IDs
- addresses
- location
- other personal information

Therefore, do NOT automatically retain every screenshot forever.

The preferred architecture is:

Screenshot
 ↓
AI extraction
 ↓
Vehicle number
 ↓
Database lookup
 ↓
Delete temporary screenshot

If report evidence is retained, implement an explicit retention policy and secure storage.

Do not expose uploaded evidence publicly by default.

============================================================
19. DATABASE
============================================================

The planned production database is Supabase/PostgreSQL.

The initial conceptual schema includes:

vehicles

- id
- registration_number
- normalized_registration_number
- created_at

reports

- id
- vehicle_id
- platform
- categories
- description
- ride_date
- created_at
- status
- severity metadata

report_evidence

- id
- report_id
- storage_path
- created_at
- expires_at

searches

- id
- vehicle_id
- platform
- created_at

Potential future abuse/security tables:

abuse_events
rate_limit_events
audit_events

Do not over-engineer the database before actual requirements appear.

============================================================
20. CURRENT DEVELOPMENT PHASE
============================================================

The project is being developed incrementally.

PHASE 1:

Frontend/PWA prototype with mock data.

The goal is:

A polished, functioning mobile-first application where the entire user journey works using mock data.

No real AI yet.

No real Supabase yet.

PHASE 2:

Connect Supabase.

Real:

- vehicles
- reports
- report persistence
- search

PHASE 3:

Connect Gemini.

Screenshot
 ↓
Gemini
 ↓
vehicle extraction
 ↓
real database lookup

PHASE 4:

AI report classification.

User report
 ↓
AI categorization
 ↓
stored structured categories

PHASE 5:

Automated abuse/spam protection.

PHASE 6:

Production hardening.

- security
- rate limiting
- privacy
- data retention
- error handling
- monitoring
- legal pages
- grievance/dispute process
- performance
- PWA polish

Do not attempt to build all phases at once.

============================================================
21. CURRENT TECH STACK
============================================================

STACK STATUS NOTE (added 2026-09-10):

The stack below (Next.js + Vercel) is what this project was SUPPOSED to use and is
still the target.

What is ACTUALLY running right now is a Vite + React + TypeScript + Tailwind app
exported from bolt.new (not Next.js). Phases 1 and 2 were built on Vite.

Migration to Next.js is planned for a later point. Until then, see ARCHITECTURE.md
for how the current Vite app is wired, and treat that file as the source of truth
for build/dev/env mechanics.

Preferred / target stack:

Frontend:
Next.js
TypeScript
Tailwind CSS

PWA:
Next.js PWA-compatible implementation

Database:
Supabase / PostgreSQL

AI:
Gemini API initially

Hosting:
Vercel

Repository:
GitHub

Development:
Google Antigravity

Do not introduce unnecessary frameworks or services.

Keep the architecture modular enough that AI providers can be swapped later.

============================================================
22. NO OVER-ENGINEERING
============================================================

This is an early-stage startup MVP.

Do NOT introduce:

- microservices
- Kubernetes
- Docker unless genuinely needed
- complex state management
- unnecessary backend servers
- multiple databases
- event buses
- complicated authentication
- native mobile frameworks
- excessive dependencies

Prefer:

simple
clear
maintainable
modular
cheap
easy to test

The application should be easy for another AI coding agent to understand.

============================================================
23. COST PHILOSOPHY
============================================================

The project should remain extremely inexpensive during validation.

Prefer free tiers where appropriate.

Avoid paid infrastructure until necessary.

AI usage should be optimized.

Do not call an expensive model when normal application logic can solve the problem.

Examples:

Database lookup:
NO AI

Registration number normalization:
NO AI

Risk calculation:
NO AI

Rate limiting:
NO AI

Basic duplicate detection:
NO AI

AI should be used only where it provides genuine value.

============================================================
24. PRIVACY / LEGAL DESIGN PRINCIPLES
============================================================

The application may process personal information belonging to:

- users
- drivers
- reporters

The product may contain allegations or negative reports associated with identifiable vehicles.

Therefore:

- minimize collected data
- avoid unnecessary personal information
- do not expose reporter identities
- do not retain screenshots unnecessarily
- clearly explain how reports work
- distinguish user reports from verified findings
- provide appropriate privacy and terms documentation
- maintain a mechanism for handling disputes/removal/correction as the product matures

The technical implementation should support these requirements.

Do not make legal claims without verification.

The final public product should receive appropriate legal review in India before launch.

============================================================
25. WHAT THE PRODUCT IS NOT
============================================================

SpotRealRedFlag is NOT:

- a police reporting system
- an emergency service
- a driver rating platform
- a driver blacklist
- a criminal-record database
- a replacement for emergency services
- a guarantee of safety
- a system that independently determines whether allegations are true

It is a community information tool.

============================================================
26. FUTURE PRODUCT DIRECTION
============================================================

Long-term possibilities include:

- Android application
- iOS application
- better screenshot sharing
- easier sharing from ride apps
- browser/mobile integrations
- additional ride platforms
- location-aware functionality
- notifications
- richer community signals
- better automated abuse prevention
- potentially partnerships/integrations with ride platforms

BUT:

Do not build these now.

The current goal is to prove:

"Will women actually use a quick community vehicle-checking tool before getting into a ride?"

============================================================
27. PRODUCT MOAT
============================================================

The AI is NOT the primary moat.

The long-term value is the community-generated database of experiences.

Each useful report can help a future user.

Therefore product priorities should eventually favor:

- easy reporting
- reliable vehicle identification
- good search
- clear report presentation
- preventing spam without discouraging genuine reports
- privacy
- trust
- fast user experience

============================================================
28. DESIGN SOURCE OF TRUTH
============================================================

The Google Stitch design is the visual source of truth.

If the Stitch project is accessible through MCP:

inspect it before making UI changes.

Do not arbitrarily redesign the application.

If implementation requires a visual decision that Stitch does not specify, choose the option that is most consistent with the existing design system.

When making significant visual changes, explain why.

============================================================
29. DEVELOPMENT BEHAVIOR
============================================================

You are not just a code generator.

Act as:

- senior frontend engineer
- product-minded engineer
- UX-aware developer
- technical architect

When implementing a feature:

1. Understand the existing architecture.
2. Inspect relevant files.
3. Avoid unnecessary rewrites.
4. Reuse existing components.
5. Implement the smallest clean solution.
6. Test it.
7. Check mobile behavior.
8. Check for regressions.
9. Explain what changed.

Do not create duplicate implementations of existing functionality.

Do not silently introduce new product features.

============================================================
30. IMPORTANT: ASK BEFORE MAJOR PRODUCT DECISIONS
============================================================

You may make normal engineering decisions independently.

However, ask before making major decisions that materially change:

- the user experience
- privacy model
- report visibility
- safety logic
- database architecture
- authentication
- pricing/business model
- supported platforms
- product scope

For small implementation details, use good engineering judgment and proceed.

============================================================
31. TESTING PHILOSOPHY
============================================================

Every major feature should be tested.

At minimum check:

- mobile layout
- desktop layout
- navigation
- forms
- validation
- empty states
- loading states
- errors
- accessibility
- no horizontal scrolling
- no console errors
- no TypeScript errors
- no broken buttons

For AI features later, create a test dataset and measure accuracy rather than assuming the AI works.

Especially for vehicle registration extraction:

Accuracy is more important than model sophistication.

============================================================
32. AI MODEL ABSTRACTION
============================================================

Do not hard-code the entire application around one specific AI model.

Create a small abstraction around AI functionality.

Conceptually:

AI Provider
   ↓
extractRideDetails()
classifyReport()
moderateContent()

This allows us to change between:

Gemini models
OpenAI models
other models

without rewriting the entire application.

The current preference is Gemini because it is inexpensive and the developer already has access to the Gemini ecosystem.

============================================================
33. IMPORTANT CURRENT STATUS
============================================================

The initial Stitch UI has already been designed and refined.

The design direction has intentionally gone through several iterations.

The final direction is:

- mobile-first
- PWA
- neutral warm background
- charcoal text
- muted indigo/lavender interaction color
- deep-red flower logo
- red reserved for actual red-flag states
- conversational Gen-Z/young-millennial tone
- minimal login friction
- no fake verification claims
- no fake statistics
- no human moderation claims
- no live monitoring claims

Do not revert to a red-heavy interface.

Do not add fake "verified" statistics.

Do not imply human moderation.

============================================================
34. THE MOST IMPORTANT PRODUCT PRINCIPLE
============================================================

The application should help a woman make a QUICKER and MORE INFORMED decision.

It should never create false certainty.

The product should communicate:

"We found these reports."

not:

"We know this driver is dangerous."

The product should empower the user rather than make the decision for her.

============================================================
35. IMMEDIATE DEVELOPMENT GOAL
============================================================

STATUS (updated 2026-09-10):

Phase 1 is complete. A functioning mobile-first PWA prototype exists covering Home,
Check Ride, Analyzing, Result (Clear/Caution/Red Flag), Community Reports, and Report
a Ride, per the Stitch design.

It is built with Vite + React + TypeScript + Tailwind (bolt.new export), NOT Next.js
as originally specified in Section 21. Migrating to Next.js is planned for later.

Phase 2 is done: src/lib/data.ts is wired to a live Supabase project (schema migration
1 applied, seed data loaded).

Phases 3 and 4 are code-complete:
- src/lib/ai/ has the swappable provider abstraction, a mock provider, and a real
  gemini provider that calls two Supabase Edge Functions (extract-ride-details,
  classify-report) so the Gemini key stays server-side.
- Screenshot upload is wired end to end with the confidence gate: an unreadable /
  low-confidence plate shows the "couldn't read" screen and never runs a DB lookup (§12).
- Report categorisation (Phase 4): a "Suggest categories from this" button on the
  report form pre-ticks AI-suggested categories (the user stays in control), and the
  classification is stored as ai_* metadata on reports (migration 3). It is NOT an
  input to the Green/Amber/Red rule.

Lightweight spam safeguards (migration 2): min description length, no phone/email in
report text (JS + DB CHECK), per-browser report rate limiting and duplicate detection
via an anonymous localStorage client_key (NOT auth).

Green/Amber/Red classification remains deterministic app code in checkVehicle (§10).

Migrations 1-3 are applied and both Edge Functions are deployed. A round of pre-launch
security hardening is done (migrations 4-6 + shared function middleware): searches is
write-only, per-IP rate limiting on the AI functions (ai_calls table, hashed IPs),
4 MB + magic-byte image validation, CORS locked to an ALLOWED_ORIGIN secret, generic
error messages, and a public_reports view. npm audit is clean for shipped deps.

Current objective:

Go live — apply migrations 4-6, set the IP_HASH_SALT secret, redeploy the functions,
set VITE_AI_PROVIDER=gemini, deploy the frontend to Vercel, then set ALLOWED_ORIGIN and
redeploy the functions. Full runbook + exact env vars / secrets in DEPLOYMENT.md.

After that:

Phase 5 — automated abuse/spam protection (beyond the lightweight safeguards already
in place).

Do not skip directly to complex production architecture.

Build, test, validate, then expand.

============================================================
END OF PROJECT CONTEXT
============================================================

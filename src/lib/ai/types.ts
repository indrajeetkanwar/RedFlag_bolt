/**
 * AI provider abstraction — shared types.
 *
 * Per PROJECT_CONTEXT.md §11, §13, §32: AI is a supporting component that returns
 * STRUCTURED data. The app makes the deterministic decisions. Providers are swappable
 * (mock / Gemini / others) behind this interface without touching the rest of the app.
 *
 * Phase 3 scope: only `extractRideDetails` is defined and implemented (mock provider).
 * `classifyReport` (Phase 4) and `moderateContent` (Phase 5) will be added to
 * `AIProvider` when those phases land.
 */

/** One extracted field plus how sure the model is about it (0..1). */
export interface FieldConfidence {
  vehicleNumber: number;
  platform: number;
  driverName: number;
  vehicleModel: number;
  vehicleColor: number;
}

/**
 * Structured result of reading a ride-booking screenshot.
 *
 * Every field is nullable: the model MUST return null rather than guess
 * (PROJECT_CONTEXT.md §12 — "The AI must NEVER guess a vehicle registration number").
 * `vehicleNumber` is the raw string as read from the image; normalisation happens
 * later in `src/lib/data.ts`.
 */
export interface ExtractedRideDetails {
  vehicleNumber: string | null;
  platform: string | null;
  driverName: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  confidence: FieldConfidence;
}

/** What the caller hands a provider. Kept minimal and transient — never persisted. */
export interface ScreenshotInput {
  /** The picked image file. Providers read it in-memory and discard it. */
  file: File;
}

/**
 * Outcome of `extractRideDetails` after the confidence gate has been applied.
 *
 * - `success`     — vehicle number read with high enough confidence; safe to look up.
 * - `low_confidence` — number missing or below threshold. The UI must ask the user to
 *   retry or type it in; it must NOT fall through to a database lookup
 *   (PROJECT_CONTEXT.md §12, §14: a false match is worse than no match).
 * - `error`       — the provider failed (bad image, provider unavailable, etc.).
 */
export type ExtractionOutcome =
  | { status: 'success'; vehicleNumber: string; details: ExtractedRideDetails }
  | { status: 'low_confidence'; details: ExtractedRideDetails }
  | { status: 'error'; message: string };

/** Free text of a report, for categorisation (Phase 4). */
export interface ReportTextInput {
  description: string;
}

/**
 * Structured categorisation of a report's free text. AI is a *supporting* component
 * here (PROJECT_CONTEXT.md §11): this is stored as metadata and used to pre-fill the
 * category checkboxes — it never overrides the user's own selection and is not an
 * input to the deterministic Green/Amber/Red logic (§10).
 */
export interface ReportClassification {
  /** Zero or more values from REPORT_CATEGORIES (src/lib/categories.ts). */
  categories: string[];
  severity: 'low' | 'medium' | 'high';
  /** Overall model confidence in this categorisation, 0..1. */
  confidence: number;
  /** Soft signal that the text may contain personal/contact info. Not a hard block. */
  personalInfoLikely: boolean;
}

/**
 * A swappable AI backend. Implementations must be pure w.r.t. app state and must not
 * persist the screenshot anywhere.
 */
export interface AIProvider {
  /** Stable identifier, e.g. "mock" or "gemini". */
  readonly name: string;
  /** Read a ride-booking screenshot into structured fields. Never throws for a
   *  low-quality image — it returns low confidence instead. Throws only on real
   *  failures (which the caller turns into an `error` outcome). */
  extractRideDetails(input: ScreenshotInput): Promise<ExtractedRideDetails>;
  /** Categorise a report's free text against the fixed taxonomy. Throws only on real
   *  failures; the caller (classifyReport in index.ts) treats a failure as "no
   *  suggestion" and never blocks the report. */
  classifyReport(input: ReportTextInput): Promise<ReportClassification>;
}

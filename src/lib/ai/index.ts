import { mockProvider } from './mockProvider';
import { geminiProvider } from './geminiProvider';
import { REPORT_CATEGORIES, REPORT_SEVERITIES } from '../categories';
import type { AIProvider, ExtractionOutcome, ReportClassification } from './types';

export type {
  AIProvider,
  ExtractedRideDetails,
  ExtractionOutcome,
  FieldConfidence,
  ReportClassification,
  ScreenshotInput,
} from './types';

/**
 * Minimum confidence for us to trust an extracted vehicle number and proceed to a
 * database lookup. Below this we ask the user to retry or type it in — we never look
 * up an uncertain plate (PROJECT_CONTEXT.md §12, §14).
 */
export const VEHICLE_NUMBER_CONFIDENCE_THRESHOLD = 0.8;

const providers: Record<string, AIProvider> = {
  mock: mockProvider,
  gemini: geminiProvider,
};

/**
 * Resolve the active AI provider from `VITE_AI_PROVIDER` (default: "mock").
 * "gemini" routes through the extract-ride-details Supabase Edge Function.
 */
export function getAIProvider(): AIProvider {
  const requested = import.meta.env?.VITE_AI_PROVIDER ?? 'mock';
  const provider = providers[requested];

  if (!provider) {
    throw new Error(
      `Unknown AI provider "${requested}" (VITE_AI_PROVIDER). ` +
        `Supported: ${Object.keys(providers).join(', ')}.`
    );
  }

  return provider;
}

/**
 * Read a ride-booking screenshot and apply the confidence gate.
 *
 * The image is passed straight to the provider and never persisted here. Callers get
 * back one of three outcomes and must handle `low_confidence` / `error` by prompting
 * the user — not by continuing with a guessed value.
 */
export async function extractRideDetails(file: File): Promise<ExtractionOutcome> {
  let details;
  try {
    details = await getAIProvider().extractRideDetails({ file });
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Screenshot analysis failed.',
    };
  }

  const trusted =
    details.vehicleNumber !== null &&
    details.vehicleNumber.trim() !== '' &&
    details.confidence.vehicleNumber >= VEHICLE_NUMBER_CONFIDENCE_THRESHOLD;

  if (!trusted) {
    return { status: 'low_confidence', details };
  }

  return { status: 'success', vehicleNumber: details.vehicleNumber as string, details };
}

/**
 * Categorise a report's free text (Phase 4). Best-effort and non-blocking: on any
 * failure it returns `null` and the report proceeds with the user's own category
 * selection. The result is sanitised to the fixed taxonomy so a misbehaving model
 * can't introduce unknown categories.
 */
export async function classifyReport(description: string): Promise<ReportClassification | null> {
  const text = description.trim();
  if (text.length < 12) return null;

  try {
    const raw = await getAIProvider().classifyReport({ description: text });
    const categories = [
      ...new Set(
        (raw.categories ?? []).filter((c) => (REPORT_CATEGORIES as readonly string[]).includes(c))
      ),
    ];
    return {
      categories: categories.length > 0 ? categories : ['Other'],
      severity: REPORT_SEVERITIES.includes(raw.severity) ? raw.severity : 'low',
      confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0)),
      personalInfoLikely: Boolean(raw.personalInfoLikely),
    };
  } catch {
    return null;
  }
}

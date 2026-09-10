import { mockProvider } from './mockProvider';
import type { AIProvider, ExtractionOutcome } from './types';

export type {
  AIProvider,
  ExtractedRideDetails,
  ExtractionOutcome,
  FieldConfidence,
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
};

/**
 * Resolve the active AI provider from `VITE_AI_PROVIDER` (default: "mock").
 * Only "mock" exists today; real providers (e.g. "gemini") register in `providers`.
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

import type { AIProvider, ExtractedRideDetails, ScreenshotInput } from './types';

/**
 * Mock AI provider — no SDK, no network, no external API.
 *
 * It exists so the whole Phase 3 flow (upload → analyzing → result, plus the
 * low-confidence branch) can be built and tested before real Gemini is wired in.
 *
 * Behaviour is driven by the picked file's NAME so a tester can force any path:
 *
 *   name contains "blur" / "lowconf" / "unclear" / "fail"  → low confidence (no number)
 *   name contains "clear"                                   → reads KA 05 MN 7788 (green)
 *   name contains "caution"                                 → reads KA 03 CD 4567 (amber)
 *   anything else                                           → reads KA 01 AB 1234 (red)
 *
 * The three "good" plates match the rows in `supabase/seed.sql`, so an end-to-end
 * check produces a real green / amber / red result.
 */

const ANALYZE_DELAY_MS = 1200;

const LOW_CONFIDENCE_HINTS = ['blur', 'lowconf', 'unclear', 'unreadable', 'fail'];

interface MockCase {
  vehicleNumber: string | null;
  platform: string | null;
  driverName: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehicleNumberConfidence: number;
}

function pickCase(fileName: string): MockCase {
  const name = fileName.toLowerCase();

  if (LOW_CONFIDENCE_HINTS.some((hint) => name.includes(hint))) {
    return {
      vehicleNumber: null,
      platform: 'Uber',
      driverName: null,
      vehicleModel: null,
      vehicleColor: null,
      vehicleNumberConfidence: 0.32,
    };
  }

  if (name.includes('clear')) {
    return {
      vehicleNumber: 'KA 05 MN 7788',
      platform: 'Ola',
      driverName: 'Suresh',
      vehicleModel: 'Maruti Suzuki Dzire',
      vehicleColor: 'White',
      vehicleNumberConfidence: 0.97,
    };
  }

  if (name.includes('caution')) {
    return {
      vehicleNumber: 'KA 03 CD 4567',
      platform: 'Rapido',
      driverName: 'Anand',
      vehicleModel: 'Bajaj RE Auto',
      vehicleColor: 'Yellow',
      vehicleNumberConfidence: 0.95,
    };
  }

  return {
    vehicleNumber: 'KA 01 AB 1234',
    platform: 'Uber',
    driverName: 'Ravi',
    vehicleModel: 'Hyundai Aura',
    vehicleColor: 'Silver',
    vehicleNumberConfidence: 0.98,
  };
}

export const mockProvider: AIProvider = {
  name: 'mock',

  async extractRideDetails({ file }: ScreenshotInput): Promise<ExtractedRideDetails> {
    // Simulate model latency so the Analyzing screen is visible. The file is never
    // read or stored — that mirrors the real no-retention contract (§18).
    await new Promise((resolve) => setTimeout(resolve, ANALYZE_DELAY_MS));

    const c = pickCase(file?.name ?? '');

    return {
      vehicleNumber: c.vehicleNumber,
      platform: c.platform,
      driverName: c.driverName,
      vehicleModel: c.vehicleModel,
      vehicleColor: c.vehicleColor,
      confidence: {
        vehicleNumber: c.vehicleNumberConfidence,
        platform: c.platform ? 0.9 : 0.2,
        driverName: c.driverName ? 0.85 : 0.2,
        vehicleModel: c.vehicleModel ? 0.8 : 0.2,
        vehicleColor: c.vehicleColor ? 0.8 : 0.2,
      },
    };
  },
};

/**
 * Supabase Edge Function: extract-ride-details
 *
 * Server-side layer for Gemini screenshot extraction. The Gemini API key lives here
 * as a Supabase secret (GEMINI_API_KEY) and is NEVER shipped to the browser bundle.
 *
 * Request  (POST, JSON):  { imageBase64: string, mimeType?: string }   (mimeType ignored)
 * Response (JSON):         ExtractedRideDetails  (see src/lib/ai/types.ts)
 *
 * Returns raw structured data only. The confidence gate that decides whether we trust
 * the vehicle number and run a DB lookup stays in the browser (src/lib/ai/index.ts,
 * PROJECT_CONTEXT.md §12).
 *
 * Security: CORS locked to ALLOWED_ORIGIN + localhost; ≤10 calls/IP/hour; image type
 * sniffed from magic bytes (client mimeType is not trusted); ≤4 MB; generic errors.
 * No auth (§4): deploy with `--no-verify-jwt`.
 *
 * Pure Gemini request/response logic is in ./gemini.ts (unit-tested from Node).
 */

// @ts-nocheck — runs on Deno (Edge runtime), not under the app's tsconfig.

import { buildGeminiRequestBody, parseGeminiResponse, type ExtractedRideDetails } from './gemini.ts';
import {
  resolveCors,
  jsonResponse,
  genericError,
  enforceIpRateLimit,
  sniffImageMime,
  callGeminiGenerate,
} from '../_shared/security.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash';

// 4 MB image ≈ 5.6M base64 chars (4 * 1024 * 1024 * 4 / 3).
const MAX_BASE64_CHARS = 5_600_000;

async function callGemini(imageBase64: string, mimeType: string): Promise<ExtractedRideDetails> {
  const data = await callGeminiGenerate(
    GEMINI_MODEL,
    GEMINI_API_KEY,
    buildGeminiRequestBody(imageBase64, mimeType)
  );
  return parseGeminiResponse(data);
}

Deno.serve(async (req: Request) => {
  const cors = resolveCors(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: cors.forbidden ? 403 : 200, headers: cors.headers });
  }
  if (cors.forbidden) return jsonResponse({ error: 'Forbidden' }, 403, cors);
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, cors);
  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not configured');
    return genericError(cors, 500);
  }

  let payload: { imageBase64?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Body must be JSON: { imageBase64 }' }, 400, cors);
  }

  const imageBase64 = typeof payload.imageBase64 === 'string' ? payload.imageBase64.trim() : '';
  if (!imageBase64) {
    return jsonResponse({ error: 'imageBase64 is required.' }, 400, cors);
  }
  if (imageBase64.length > MAX_BASE64_CHARS) {
    return jsonResponse({ error: 'That image is too large — please use one under 4 MB.' }, 413, cors);
  }

  // Trust the bytes, not the client-supplied mimeType.
  const mimeType = sniffImageMime(imageBase64);
  if (!mimeType) {
    return jsonResponse(
      { error: "That file doesn't look like a supported image (JPEG, PNG, WebP or HEIC)." },
      400,
      cors
    );
  }

  const limited = await enforceIpRateLimit(req, 'extract-ride-details', cors);
  if (limited) return limited;

  try {
    const details = await callGemini(imageBase64, mimeType);
    // The screenshot is not stored anywhere — it lives only for this request (§18).
    return jsonResponse(details, 200, cors);
  } catch (err) {
    console.error('extract-ride-details failed:', err);
    return genericError(cors);
  }
});

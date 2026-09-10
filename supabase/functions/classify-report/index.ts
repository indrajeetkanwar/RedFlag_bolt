/**
 * Supabase Edge Function: classify-report
 *
 * Categorises a report's free text against the fixed taxonomy, via Gemini. The key
 * (GEMINI_API_KEY secret) stays server-side, never in the browser bundle.
 *
 * Request  (POST, JSON):  { description: string }
 * Response (JSON):         ReportClassification  (see src/lib/ai/types.ts)
 *
 * AI is a supporting component here (PROJECT_CONTEXT.md §11): the result pre-fills the
 * category checkboxes and is stored as metadata. It never overrides the user's own
 * selection and is not an input to the deterministic Green/Amber/Red logic (§10).
 *
 * Security: CORS locked to ALLOWED_ORIGIN + localhost; ≤10 calls/IP/hour; generic
 * errors. No auth (§4): deploy with `--no-verify-jwt`.
 *
 * Pure request/response logic is in ./classify.ts (unit-tested from Node).
 */

// @ts-nocheck — runs on Deno (Edge runtime), not under the app's tsconfig.

import { buildGeminiRequestBody, parseGeminiResponse, type ReportClassification } from './classify.ts';
import {
  resolveCors,
  jsonResponse,
  genericError,
  enforceIpRateLimit,
  callGeminiGenerate,
} from '../_shared/security.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash';

const MAX_DESCRIPTION_CHARS = 4000;

async function callGemini(description: string): Promise<ReportClassification> {
  const data = await callGeminiGenerate(
    GEMINI_MODEL,
    GEMINI_API_KEY,
    buildGeminiRequestBody(description)
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

  let payload: { description?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Body must be JSON: { description }' }, 400, cors);
  }

  const description = typeof payload.description === 'string' ? payload.description.trim() : '';
  if (!description) return jsonResponse({ error: 'description is required.' }, 400, cors);
  if (description.length > MAX_DESCRIPTION_CHARS) {
    return jsonResponse({ error: 'That description is too long.' }, 413, cors);
  }

  const limited = await enforceIpRateLimit(req, 'classify-report', cors);
  if (limited) return limited;

  try {
    return jsonResponse(await callGemini(description), 200, cors);
  } catch (err) {
    console.error('classify-report failed:', err);
    return genericError(cors);
  }
});

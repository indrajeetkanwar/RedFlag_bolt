/**
 * Supabase Edge Function: extract-ride-details
 *
 * Server-side layer for Gemini screenshot extraction. The Gemini API key lives here
 * as a Supabase secret (GEMINI_API_KEY) and is NEVER shipped to the browser bundle.
 *
 * Request  (POST, JSON):  { imageBase64: string, mimeType: string }
 * Response (JSON):         ExtractedRideDetails  (see src/lib/ai/types.ts)
 *
 * This function returns raw structured data only. The confidence gate that decides
 * whether we trust the vehicle number and run a DB lookup stays in the browser
 * (src/lib/ai/index.ts) — see PROJECT_CONTEXT.md §12.
 *
 * No auth (PROJECT_CONTEXT.md §4): deploy with `--no-verify-jwt` / verify_jwt=false
 * in supabase/config.toml. Callers still send the Supabase anon key as `apikey`.
 *
 * Pure request/response logic is in ./gemini.ts so it can be unit-tested from Node.
 */

// @ts-nocheck — runs on Deno (Edge runtime), not under the app's tsconfig.

import {
  buildGeminiRequestBody,
  parseGeminiResponse,
  type ExtractedRideDetails,
} from './gemini.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const MAX_BASE64_CHARS = 14_000_000; // ~10 MB image

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function callGemini(imageBase64: string, mimeType: string): Promise<ExtractedRideDetails> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent` +
    `?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGeminiRequestBody(imageBase64, mimeType)),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini API ${res.status}: ${detail.slice(0, 500)}`);
  }

  return parseGeminiResponse(await res.json());
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY is not configured' }, 500);

  let payload: { imageBase64?: unknown; mimeType?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Body must be JSON: { imageBase64, mimeType }' }, 400);
  }

  const imageBase64 = typeof payload.imageBase64 === 'string' ? payload.imageBase64 : '';
  const mimeType = typeof payload.mimeType === 'string' ? payload.mimeType.toLowerCase() : '';

  if (!imageBase64 || !mimeType) {
    return json({ error: 'imageBase64 and mimeType are required' }, 400);
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    return json({ error: `Unsupported mimeType "${mimeType}"` }, 415);
  }
  if (imageBase64.length > MAX_BASE64_CHARS) {
    return json({ error: 'Image too large' }, 413);
  }

  try {
    const details = await callGemini(imageBase64, mimeType);
    // The screenshot is not stored anywhere — it lives only for this request (§18).
    return json(details);
  } catch (err) {
    console.error('extract-ride-details failed:', err);
    return json({ error: err instanceof Error ? err.message : 'Extraction failed' }, 502);
  }
});

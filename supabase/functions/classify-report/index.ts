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
 * No auth (§4): deploy with `--no-verify-jwt` / verify_jwt=false in config.toml.
 * Pure request/response logic is in ./classify.ts so it can be unit-tested from Node.
 */

// @ts-nocheck — runs on Deno (Edge runtime), not under the app's tsconfig.

import {
  buildGeminiRequestBody,
  parseGeminiResponse,
  type ReportClassification,
} from './classify.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_DESCRIPTION_CHARS = 4000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function callGemini(description: string): Promise<ReportClassification> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent` +
    `?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGeminiRequestBody(description)),
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

  let payload: { description?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Body must be JSON: { description }' }, 400);
  }

  const description = typeof payload.description === 'string' ? payload.description.trim() : '';
  if (!description) return json({ error: 'description is required' }, 400);
  if (description.length > MAX_DESCRIPTION_CHARS) return json({ error: 'description too long' }, 413);

  try {
    return json(await callGemini(description));
  } catch (err) {
    console.error('classify-report failed:', err);
    return json({ error: err instanceof Error ? err.message : 'Classification failed' }, 502);
  }
});

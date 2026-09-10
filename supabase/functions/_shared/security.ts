/**
 * Shared security helpers for the AI Edge Functions: CORS/origin allowlist,
 * per-IP rate limiting, image sniffing, and a generic error response.
 *
 * Runs on Deno. Not covered by the app's tsconfig / eslint.
 */

// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

export { sniffImageMime } from './image.ts';

const LOCAL_DEV_ORIGIN = 'http://localhost:5173';
const RATE_LIMIT_PER_HOUR = 10;
const DEFAULT_SALT = 'srrf-unsalted-set-IP_HASH_SALT'; // fallback only; set the secret

const BASE_CORS: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
};

export interface Cors {
  headers: Record<string, string>;
  /** true → the request's Origin is a browser origin that is not allowed. */
  forbidden: boolean;
}

/**
 * Resolve CORS for a request against the allowlist:
 * `ALLOWED_ORIGIN` secret (the Vercel URL) + `http://localhost:5173`.
 * Requests with no `Origin` header (curl, server-to-server) are allowed through —
 * they can't be CSRF and are still covered by the IP rate limit.
 */
export function resolveCors(req: Request): Cors {
  const allowlist = [Deno.env.get('ALLOWED_ORIGIN'), LOCAL_DEV_ORIGIN].filter(Boolean) as string[];
  const origin = req.headers.get('Origin');

  if (!origin) return { headers: { ...BASE_CORS }, forbidden: false };
  if (allowlist.includes(origin)) {
    return { headers: { ...BASE_CORS, 'Access-Control-Allow-Origin': origin }, forbidden: false };
  }
  return { headers: { ...BASE_CORS }, forbidden: true };
}

export function jsonResponse(body: unknown, status: number, cors: Cors): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors.headers, 'Content-Type': 'application/json' },
  });
}

/** One generic message for every server/upstream failure — never leak provider detail. */
export function genericError(cors: Cors, status = 502): Response {
  return jsonResponse({ error: 'Something went wrong — please try again.' }, status, cors);
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );
}

/**
 * Enforce ≤ 10 calls per IP per hour for `functionName`. Returns a 429 `Response` when
 * the limit is hit, otherwise records the call and returns `null` (proceed).
 * Fails open on infra error (logs, does not block a legit user).
 */
export async function enforceIpRateLimit(
  req: Request,
  functionName: string,
  cors: Cors
): Promise<Response | null> {
  const rawIp = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const salt = Deno.env.get('IP_HASH_SALT') ?? DEFAULT_SALT;
  const ipHash = await sha256Hex(`${salt}:${rawIp}`);
  const sinceIso = new Date(Date.now() - 3_600_000).toISOString();

  const db = serviceClient();

  const { count, error } = await db
    .from('ai_calls')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('function_name', functionName)
    .gte('called_at', sinceIso);

  if (error) {
    console.error('rate-limit check failed (failing open):', error.message);
    return null;
  }

  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return jsonResponse(
      { error: 'Too many requests — please wait a little while and try again.' },
      429,
      cors
    );
  }

  const { error: insertError } = await db
    .from('ai_calls')
    .insert({ ip_hash: ipHash, function_name: functionName });
  if (insertError) console.error('rate-limit record failed:', insertError.message);

  return null;
}

// sniffImageMime lives in ./image.ts (pure, Node-testable) and is re-exported above.

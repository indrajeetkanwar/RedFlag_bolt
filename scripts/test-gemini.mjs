/**
 * Live Gemini extraction check — calls the real Gemini API with the SAME prompt,
 * schema and mapping the Edge Function uses, so you can verify extraction quality
 * without deploying anything.
 *
 *   GEMINI_API_KEY=xxx node scripts/test-gemini.mjs path/to/screenshot.png
 *   GEMINI_API_KEY=xxx GEMINI_MODEL=gemini-2.0-flash node scripts/test-gemini.mjs shot.jpg
 *
 * With no path it uses scripts/fixtures/ride.png (a 1x1 pixel — expect nulls / low
 * confidence, which still proves the request + mapping + gate path works).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as esbuild from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
const CONFIDENCE_THRESHOLD = 0.8; // mirrors src/lib/ai/index.ts

if (!KEY) {
  console.error('Set GEMINI_API_KEY. Get one at https://aistudio.google.com/apikey');
  process.exit(2);
}

const imgPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(root, 'scripts/fixtures/ride.png');

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const mimeType = MIME[extname(imgPath).toLowerCase()];
if (!mimeType) { console.error('Unsupported image type:', imgPath); process.exit(2); }

// Bundle the Edge Function's pure logic and reuse it verbatim.
const work = mkdtempSync(join(tmpdir(), 'srrf-gem-'));
const out = join(work, 'gemini.mjs');
await esbuild.build({
  entryPoints: [resolve(root, 'supabase/functions/extract-ride-details/gemini.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'warning',
});
const { buildGeminiRequestBody, parseGeminiResponse } = await import('file://' + out);
rmSync(work, { recursive: true, force: true });

const imageBase64 = readFileSync(imgPath).toString('base64');
console.log(`model=${MODEL}  image=${imgPath} (${mimeType})\n`);

const t0 = Date.now();
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGeminiRequestBody(imageBase64, mimeType)),
  }
);
const ms = Date.now() - t0;

if (!res.ok) {
  console.error(`Gemini API ${res.status}:\n${(await res.text()).slice(0, 800)}`);
  process.exit(1);
}

const details = parseGeminiResponse(await res.json());
console.log('mapped ExtractedRideDetails:');
console.dir(details, { depth: null });

const gate =
  details.vehicleNumber && details.confidence.vehicleNumber >= CONFIDENCE_THRESHOLD
    ? `SUCCESS -> would look up "${details.vehicleNumber}"`
    : 'LOW CONFIDENCE -> would show the "couldn\'t read" screen (no DB lookup)';
console.log(`\ngate @ ${CONFIDENCE_THRESHOLD}: ${gate}`);
console.log(`latency: ${ms}ms`);

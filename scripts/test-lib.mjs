/**
 * Pure-logic tests — no browser, no network. Bundles the relevant TS with esbuild
 * (already a dependency of vite) and asserts behaviour.
 *
 *   node scripts/test-lib.mjs
 *
 * Covers: report content validation (src/lib/reportValidation.ts) and the Gemini
 * response mapping (supabase/functions/extract-ride-details/gemini.ts).
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(join(tmpdir(), 'srrf-test-'));

let failures = 0;
const eq = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log('  ok  ', label); }
  else { failures++; console.error('  FAIL', label, '\n    expected', e, '\n    got     ', a); }
};

async function bundle(entry) {
  const out = join(work, entry.replace(/[\\/]/g, '_') + '.mjs');
  await esbuild.build({
    entryPoints: [join(root, entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: out,
    logLevel: 'warning',
  });
  return import('file://' + out);
}

// --- report validation ------------------------------------------------------
const { validateDescription, MIN_DESCRIPTION_LENGTH } = await bundle('src/lib/reportValidation.ts');
console.log('validateDescription:');
eq('too short', validateDescription('too short').ok, false);
eq('exactly min length ok', validateDescription('x'.repeat(MIN_DESCRIPTION_LENGTH)).ok, true);
eq('normal report ok', validateDescription('Driver was rude and took a strange detour late at night.').ok, true);
eq('blocks indian mobile', validateDescription('Call me later on 9876543210 about this incident please.').ok, false);
eq('blocks +91 mobile', validateDescription('My number is +91 98765 43210 if you need more details here.').ok, false);
eq('blocks email', validateDescription('Reach me at someone@example.com for the full story of what happened.').ok, false);
eq('blocks long digit run', validateDescription('The trip id shown was 12345678901234 on the receipt screen there.').ok, false);
eq('allows short numbers', validateDescription('He was about 30 and the car had 4 doors, nothing else of note here.').ok, true);

// --- gemini response mapping ----------------------------------------------
const g = await bundle('supabase/functions/extract-ride-details/gemini.ts');
console.log('toExtractedRideDetails:');
eq('maps a good read',
  g.toExtractedRideDetails({ vehicle_number: ' KA01AB1234 ', platform: 'Uber', driver_name: 'Ravi', vehicle_model: null, vehicle_color: '', confidence: { vehicle_number: 0.97, platform: 0.9, driver_name: 0.8, vehicle_model: 0.1, vehicle_color: 0.1 } }),
  { vehicleNumber: 'KA01AB1234', platform: 'Uber', driverName: 'Ravi', vehicleModel: null, vehicleColor: null, confidence: { vehicleNumber: 0.97, platform: 0.9, driverName: 0.8, vehicleModel: 0.1, vehicleColor: 0.1 } });
eq('null number -> confidence 0',
  g.toExtractedRideDetails({ vehicle_number: null, platform: 'Ola', driver_name: null, vehicle_model: null, vehicle_color: null, confidence: { vehicle_number: 0.9, platform: 0.7, driver_name: 0, vehicle_model: 0, vehicle_color: 0 } }).confidence.vehicleNumber,
  0);
eq('"null" string treated as null', g.toExtractedRideDetails({ vehicle_number: 'null', confidence: {} }).vehicleNumber, null);
eq('confidence clamped', g.toExtractedRideDetails({ vehicle_number: 'KA01AB1234', confidence: { vehicle_number: 5 } }).confidence.vehicleNumber, 1);
eq('parseGeminiResponse extracts text part',
  g.parseGeminiResponse({ candidates: [{ content: { parts: [{ text: '{"vehicle_number":"KA05MN7788","confidence":{"vehicle_number":0.95}}' }] } }] }).vehicleNumber,
  'KA05MN7788');

// --- report classification mapping (Phase 4) -----------------------------
const c = await bundle('supabase/functions/classify-report/classify.ts');
console.log('toReportClassification:');
eq('keeps known categories, drops unknown, dedupes',
  c.toReportClassification({ categories: ['Unsafe driving', 'Totally Made Up', 'Unsafe driving'], severity: 'medium', confidence: 0.7, personal_info_likely: false }).categories,
  ['Unsafe driving']);
eq('empty categories -> ["Other"]',
  c.toReportClassification({ categories: [], severity: 'low', confidence: 0.2, personal_info_likely: false }).categories,
  ['Other']);
eq('bad severity -> low', c.toReportClassification({ categories: ['Other'], severity: 'catastrophic', confidence: 0.5, personal_info_likely: false }).severity, 'low');
eq('confidence clamped', c.toReportClassification({ categories: ['Other'], severity: 'low', confidence: 9, personal_info_likely: false }).confidence, 1);
eq('personal info flag coerced to boolean', c.toReportClassification({ categories: ['Other'], severity: 'low', confidence: 0.5, personal_info_likely: 1 }).personalInfoLikely, true);

// --- mock provider classifyReport --------------------------------------
const m = await bundle('src/lib/ai/mockProvider.ts');
console.log('mockProvider.classifyReport:');
eq('detects "followed" -> high severity',
  (await m.mockProvider.classifyReport({ description: 'The driver followed me back towards my building after the ride ended.' })).categories.includes('Driver followed me'),
  true);
eq('rude/shouting -> Verbal abuse',
  (await m.mockProvider.classifyReport({ description: 'He was extremely rude and started shouting when I asked him to slow down.' })).categories.includes('Verbal abuse'),
  true);
eq('bland text -> Other',
  (await m.mockProvider.classifyReport({ description: 'The ride was mostly fine but the seats were uncomfortable and it was slow.' })).categories,
  ['Other']);

rmSync(work, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nAll pure-logic tests passed.');

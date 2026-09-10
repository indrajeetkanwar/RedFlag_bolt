/**
 * Pure Gemini request-building / response-mapping. No Deno, no network — so it can be
 * unit-tested from Node (see scripts/test-extract-fn.mjs). index.ts adds the HTTP
 * server, env, CORS and the actual fetch.
 */

export const PROMPT = [
  'You are reading a screenshot from an Indian ride-booking app (Uber, Ola, Rapido,',
  'Namma Yatri, or another). Extract ride details as JSON matching the schema.',
  '',
  'Rules:',
  '- vehicle_number: the vehicle registration/number plate EXACTLY as shown',
  '  (e.g. "KA 01 AB 1234"). Do NOT invent or auto-correct characters.',
  '- If the registration number is not fully and clearly legible, set vehicle_number',
  '  to null and confidence.vehicle_number below 0.4. A wrong number is far worse',
  '  than no number.',
  '- platform: one of "Uber", "Ola", "Rapido", "Namma Yatri", or "Other".',
  '- For any field you cannot read, use null and a low confidence value.',
  '- Every confidence value is your own certainty from 0 to 1. Be conservative.',
  '- Return only the JSON object.',
].join('\n');

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    vehicle_number: { type: 'STRING', nullable: true },
    platform: { type: 'STRING', nullable: true },
    driver_name: { type: 'STRING', nullable: true },
    vehicle_model: { type: 'STRING', nullable: true },
    vehicle_color: { type: 'STRING', nullable: true },
    confidence: {
      type: 'OBJECT',
      properties: {
        vehicle_number: { type: 'NUMBER' },
        platform: { type: 'NUMBER' },
        driver_name: { type: 'NUMBER' },
        vehicle_model: { type: 'NUMBER' },
        vehicle_color: { type: 'NUMBER' },
      },
      required: ['vehicle_number', 'platform', 'driver_name', 'vehicle_model', 'vehicle_color'],
    },
  },
  required: [
    'vehicle_number',
    'platform',
    'driver_name',
    'vehicle_model',
    'vehicle_color',
    'confidence',
  ],
};

export interface ExtractedRideDetails {
  vehicleNumber: string | null;
  platform: string | null;
  driverName: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  confidence: {
    vehicleNumber: number;
    platform: number;
    driverName: number;
    vehicleModel: number;
    vehicleColor: number;
  };
}

export function clamp01(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return Math.min(1, Math.max(0, v));
}

export function cleanString(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  return t === '' || t.toLowerCase() === 'null' || t.toLowerCase() === 'unknown' ? null : t;
}

/** Map Gemini's snake_case JSON onto the app's ExtractedRideDetails shape. */
export function toExtractedRideDetails(raw: Record<string, unknown>): ExtractedRideDetails {
  const c = (raw.confidence ?? {}) as Record<string, unknown>;
  const vehicleNumber = cleanString(raw.vehicle_number);

  return {
    vehicleNumber,
    platform: cleanString(raw.platform),
    driverName: cleanString(raw.driver_name),
    vehicleModel: cleanString(raw.vehicle_model),
    vehicleColor: cleanString(raw.vehicle_color),
    confidence: {
      // No number read -> confidence 0, whatever the model claimed. The browser's
      // gate (src/lib/ai/index.ts) then routes to the "couldn't read" screen.
      vehicleNumber: vehicleNumber ? clamp01(c.vehicle_number) : 0,
      platform: clamp01(c.platform),
      driverName: clamp01(c.driver_name),
      vehicleModel: clamp01(c.vehicle_model),
      vehicleColor: clamp01(c.vehicle_color),
    },
  };
}

export function buildGeminiRequestBody(imageBase64: string, mimeType: string) {
  return {
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };
}

/** Pull the JSON text part out of a Gemini generateContent response and map it. */
export function parseGeminiResponse(data: unknown): ExtractedRideDetails {
  const text = (data as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] })
    ?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error('Gemini returned no text part');
  }
  return toExtractedRideDetails(JSON.parse(text));
}

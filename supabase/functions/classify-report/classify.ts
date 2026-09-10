/**
 * Pure Gemini request-building / response-mapping for report categorisation.
 * No Deno, no network — unit-tested from Node (scripts/test-lib.mjs).
 */

// Kept in sync with src/lib/categories.ts (REPORT_CATEGORIES).
export const CATEGORIES = [
  'Harassment / inappropriate behaviour',
  'Unsafe driving',
  'Threatening behaviour',
  'Driver followed me',
  'Driver contacted me after the ride',
  'Verbal abuse',
  'Route-related concern',
  'Other',
];

const SEVERITIES = ['low', 'medium', 'high'];

export const PROMPT = [
  'You categorise a woman-submitted report about an Indian cab/auto ride against a',
  'FIXED list of categories. You are a supporting tool, not a judge.',
  '',
  'Rules:',
  '- categories: pick every category from the allowed list that clearly applies.',
  '  Use "Other" only if nothing else fits. Do not invent categories.',
  '- severity: "low", "medium", or "high" — your read of how serious the described',
  '  experience is. Following, threats, and physical/sexual misconduct are "high".',
  '- confidence: 0..1, your certainty in this categorisation overall.',
  '- personal_info_likely: true if the text seems to contain a phone number, email,',
  '  address, or a named third party.',
  '- Do not restate or judge the incident. Return only the JSON object.',
].join('\n');

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    categories: {
      type: 'ARRAY',
      items: { type: 'STRING', enum: CATEGORIES },
    },
    severity: { type: 'STRING', enum: SEVERITIES },
    confidence: { type: 'NUMBER' },
    personal_info_likely: { type: 'BOOLEAN' },
  },
  required: ['categories', 'severity', 'confidence', 'personal_info_likely'],
};

export interface ReportClassification {
  categories: string[];
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  personalInfoLikely: boolean;
}

function clamp01(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return Math.min(1, Math.max(0, v));
}

/** Map + sanitise Gemini's JSON: drop unknown categories, default severity, clamp. */
export function toReportClassification(raw: Record<string, unknown>): ReportClassification {
  const rawCategories = Array.isArray(raw.categories) ? raw.categories : [];
  const categories = [
    ...new Set(rawCategories.filter((c): c is string => typeof c === 'string' && CATEGORIES.includes(c))),
  ];

  const severity =
    typeof raw.severity === 'string' && SEVERITIES.includes(raw.severity)
      ? (raw.severity as ReportClassification['severity'])
      : 'low';

  return {
    categories: categories.length > 0 ? categories : ['Other'],
    severity,
    confidence: clamp01(raw.confidence),
    personalInfoLikely: Boolean(raw.personal_info_likely),
  };
}

export function buildGeminiRequestBody(description: string) {
  return {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${PROMPT}\n\nReport text:\n"""\n${description}\n"""` }],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };
}

export function parseGeminiResponse(data: unknown): ReportClassification {
  const text = (data as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] })
    ?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error('Gemini returned no text part');
  }
  return toReportClassification(JSON.parse(text));
}

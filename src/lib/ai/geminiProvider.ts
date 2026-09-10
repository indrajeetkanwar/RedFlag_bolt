import type {
  AIProvider,
  ExtractedRideDetails,
  ReportClassification,
  ReportTextInput,
  ScreenshotInput,
} from './types';

/**
 * Real provider — talks to the Supabase Edge Functions (`extract-ride-details`,
 * `classify-report`), which hold the Gemini API key server-side. Nothing secret is in
 * this file or the bundle.
 *
 * Activate by setting `VITE_AI_PROVIDER=gemini` (requires the functions deployed and
 * the GEMINI_API_KEY secret set — see DEPLOYMENT.md).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = `AI service error (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error) message = String(errBody.error);
    } catch {
      /* keep the status-code message */
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

/** Read a File into base64 (no data: prefix) + its mime type. */
function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image file.'));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve({
        base64: comma >= 0 ? result.slice(comma + 1) : result,
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.readAsDataURL(file);
  });
}

export const geminiProvider: AIProvider = {
  name: 'gemini',

  async extractRideDetails({ file }: ScreenshotInput): Promise<ExtractedRideDetails> {
    const { base64, mimeType } = await fileToBase64(file);
    return callFunction<ExtractedRideDetails>('extract-ride-details', {
      imageBase64: base64,
      mimeType,
    });
  },

  async classifyReport({ description }: ReportTextInput): Promise<ReportClassification> {
    return callFunction<ReportClassification>('classify-report', { description });
  },
};

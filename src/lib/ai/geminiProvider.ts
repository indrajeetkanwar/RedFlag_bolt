import type { AIProvider, ExtractedRideDetails, ScreenshotInput } from './types';

/**
 * Real provider — talks to the `extract-ride-details` Supabase Edge Function, which
 * holds the Gemini API key server-side. Nothing secret is in this file or the bundle.
 *
 * Activate by setting `VITE_AI_PROVIDER=gemini` (requires the function deployed and
 * the GEMINI_API_KEY secret set — see ARCHITECTURE.md §10).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/extract-ride-details`;

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

    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ imageBase64: base64, mimeType }),
    });

    if (!res.ok) {
      let message = `Extraction service error (${res.status})`;
      try {
        const body = await res.json();
        if (body?.error) message = String(body.error);
      } catch {
        /* keep the status-code message */
      }
      throw new Error(message);
    }

    return (await res.json()) as ExtractedRideDetails;
  },
};

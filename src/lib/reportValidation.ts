/**
 * Client-side report content rules — the friendly first line of spam / privacy
 * defence. The same rules are enforced unbypassably as CHECK constraints on the
 * `reports` table (see supabase/migrations/20260910073537_spam_safeguards.sql);
 * these just give the user a clear message before the insert is attempted.
 *
 * Keep this in sync with that migration's regexes.
 */

export const MIN_DESCRIPTION_LENGTH = 20;

// Phone / long-number checks run against the text with spaces and hyphens removed,
// so "+91 98765 43210" and "98765-43210" are caught too. Keep in sync with the
// CHECK constraint in supabase/migrations/20260910073537_spam_safeguards.sql.
const INDIAN_MOBILE = /(\+?91)?[6-9]\d{9}/;
const LONG_DIGIT_RUN = /\d{10,}/;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

export type ReportContentIssue =
  | { ok: true }
  | { ok: false; message: string };

/** Validate the free-text description of a report. */
export function validateDescription(raw: string): ReportContentIssue {
  const text = raw.trim();

  if (text.length < MIN_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      message: `Please add a bit more detail — at least ${MIN_DESCRIPTION_LENGTH} characters so the report is useful to someone else.`,
    };
  }

  const compact = text.replace(/[\s-]/g, '');
  if (INDIAN_MOBILE.test(compact) || LONG_DIGIT_RUN.test(compact) || EMAIL.test(text)) {
    return {
      ok: false,
      message:
        "Please remove phone numbers, emails, or other contact details. Reports are anonymous and shouldn't identify anyone.",
    };
  }

  return { ok: true };
}

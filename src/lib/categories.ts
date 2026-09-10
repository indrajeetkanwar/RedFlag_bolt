/**
 * The report category taxonomy — single source of truth.
 *
 * Used by the report form (src/App.tsx), the mock AI provider, and passed to Gemini
 * in the classify-report function's prompt. Keep it in sync with
 * PROJECT_CONTEXT.md §16 (the list there "can evolve").
 */
export const REPORT_CATEGORIES = [
  'Harassment / inappropriate behaviour',
  'Unsafe driving',
  'Threatening behaviour',
  'Driver followed me',
  'Driver contacted me after the ride',
  'Verbal abuse',
  'Route-related concern',
  'Other',
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export function isReportCategory(value: string): value is ReportCategory {
  return (REPORT_CATEGORIES as readonly string[]).includes(value);
}

export type ReportSeverity = 'low' | 'medium' | 'high';
export const REPORT_SEVERITIES: ReportSeverity[] = ['low', 'medium', 'high'];

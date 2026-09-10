/**
 * Anonymous per-browser id — used only for rate limiting and duplicate detection.
 *
 * This is NOT authentication and NOT a user account (PROJECT_CONTEXT.md §4). It is a
 * random value with no personal information, stored in localStorage. If the user
 * clears storage they get a new one; that is acceptable for lightweight spam control.
 */

const STORAGE_KEY = 'srrf_client_key';

export function getClientKey(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const key =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `ck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    localStorage.setItem(STORAGE_KEY, key);
    return key;
  } catch {
    // localStorage unavailable (private mode, disabled). Fall back to an ephemeral
    // key — rate limiting simply won't persist across reloads in that case.
    return `ck_ephemeral_${Math.random().toString(36).slice(2, 12)}`;
  }
}

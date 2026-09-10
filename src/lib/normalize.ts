export function normalizeRegistration(input: string): string {
  return input.replace(/\s/g, '').toUpperCase();
}

/**
 * Image type sniffing from base64 magic bytes. Pure (uses only `atob`, which exists on
 * Deno and Node) so it can be unit-tested from Node — see scripts/test-lib.mjs.
 */

const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'];

/**
 * Returns 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' from the first
 * bytes of a base64 image, or `null` if it isn't one of those. The client-supplied
 * mime type is never trusted; this is derived from the bytes.
 */
export function sniffImageMime(base64: string): string | null {
  let head: Uint8Array;
  try {
    const bin = atob(base64.slice(0, 64));
    head = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
  if (head.length < 12) return null;

  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'image/png';

  // WebP: "RIFF" .... "WEBP"
  if (
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  ) {
    return 'image/webp';
  }

  // HEIC/HEIF: "ftyp" at bytes 4-7, known brand at 8-11
  if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
    if (HEIF_BRANDS.includes(brand)) return 'image/heic';
  }

  return null;
}

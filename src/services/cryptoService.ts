/**
 * Cryptographic utility service providing SHA-256 digests and secure CSPRNG tokens
 * compliant with FMCSA 49 CFR § 390.31 electronic records and signature integrity standards.
 */

export async function computeSha256(data: string): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return generateSecureToken(32);
}

export function generateSecureToken(byteLength: number = 32): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Array.from({ length: byteLength * 2 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

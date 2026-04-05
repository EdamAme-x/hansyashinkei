const META_KEY = "hs-xk";

function getOrCreateKey(): string {
  let key = localStorage.getItem(META_KEY);
  if (key && key.length >= 16) return key;

  // Generate a random 32-char key and persist
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  key = btoa(String.fromCharCode(...bytes));
  localStorage.setItem(META_KEY, key);
  return key;
}

let cachedKey: string | null = null;
function xorKey(): string {
  if (!cachedKey) cachedKey = getOrCreateKey();
  return cachedKey;
}

function xorApply(input: string, key: string): string {
  const out: string[] = [];
  for (let i = 0; i < input.length; i++) {
    out.push(String.fromCharCode(input.charCodeAt(i) ^ key.charCodeAt(i % key.length)));
  }
  return out.join("");
}

function encode(plain: string): string {
  return btoa(xorApply(plain, xorKey()));
}

function decode(encoded: string): string {
  try {
    return xorApply(atob(encoded), xorKey());
  } catch {
    return "";
  }
}

/** Check if a raw value looks like base64-encoded XOR data vs plain text */
function isEncoded(raw: string): boolean {
  // Base64 only contains [A-Za-z0-9+/=]
  return /^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 0;
}

/**
 * Encrypted localStorage wrapper using XOR + base64.
 * Auto-migrates plain text values on first read.
 */
import type { KVStore } from "@domain/repositories/KVStore";

export class EncryptedLocalStorage implements KVStore {
  get(key: string): string | null {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;

    // Try decoding as XOR
    if (isEncoded(raw)) {
      const decoded = decode(raw);
      // Validate: decoded should be printable / valid JSON-ish
      if (decoded.length > 0 && isPrintable(decoded)) {
        return decoded;
      }
    }

    // Plain text fallback (pre-migration) — migrate in place
    localStorage.setItem(key, encode(raw));
    return raw;
  }

  set(key: string, value: string): void {
    localStorage.setItem(key, encode(value));
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }
}

function isPrintable(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x09 || (c > 0x0d && c < 0x20)) return false;
  }
  return true;
}

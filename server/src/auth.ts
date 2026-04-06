const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ROOM_ID_LENGTH = 5;

export function generateRoomId(): string {
  const bytes = new Uint8Array(ROOM_ID_LENGTH);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    id += CHARSET[bytes[i] % CHARSET.length];
  }
  return id;
}

export function generateKeyPart(): Uint8Array {
  const key = new Uint8Array(16);
  crypto.getRandomValues(key);
  return key;
}

export function combineKeys(a: Uint8Array, b: Uint8Array): Uint8Array {
  const combined = new Uint8Array(32);
  combined.set(a, 0);
  combined.set(b, 16);
  return combined;
}

export async function hmacSign(key: Uint8Array, data: string): Promise<string> {
  const rawKey = new Uint8Array(key.buffer, key.byteOffset, key.byteLength) as Uint8Array<ArrayBuffer>;
  const cryptoKey = await crypto.subtle.importKey(
    "raw", rawKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return base64Encode(new Uint8Array(sig));
}

export async function hmacVerify(key: Uint8Array, data: string, signature: string): Promise<boolean> {
  const rawKey = new Uint8Array(key.buffer, key.byteOffset, key.byteLength) as Uint8Array<ArrayBuffer>;
  const cryptoKey = await crypto.subtle.importKey(
    "raw", rawKey, { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  );
  try {
    const sigBytes = base64Decode(signature);
    const sigBuf = new Uint8Array(sigBytes.buffer, sigBytes.byteOffset, sigBytes.byteLength) as Uint8Array<ArrayBuffer>;
    return await crypto.subtle.verify("HMAC", cryptoKey, sigBuf, new TextEncoder().encode(data));
  } catch {
    return false;
  }
}

export function base64Encode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function base64Decode(str: string): Uint8Array {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function xorEncrypt(key: Uint8Array, data: string): string {
  const bytes = new TextEncoder().encode(data);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ key[i % key.length];
  }
  return base64Encode(out);
}

export function xorDecrypt(key: Uint8Array, encoded: string): string {
  const bytes = base64Decode(encoded);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ key[i % key.length];
  }
  return new TextDecoder().decode(out);
}

export function validateUsername(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 10) return null;
  return trimmed;
}

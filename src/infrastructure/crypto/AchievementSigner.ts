const DB_NAME = "device-keys";
const STORE_NAME = "keys";
const HMAC_KEY_ID = "hmac-device-key";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getOrCreateHmacKey(): Promise<CryptoKey> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const existing = await new Promise<CryptoKey | undefined>((resolve) => {
    const req = store.get(HMAC_KEY_ID);
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
    req.onerror = () => resolve(undefined);
  });

  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-256" },
    false, // non-extractable
    ["sign", "verify"],
  );

  store.put(key, HMAC_KEY_ID);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return key;
}

import type { SignPayload, AchievementSigner } from "@domain/repositories/AchievementSigner";
export type { SignPayload } from "@domain/repositories/AchievementSigner";

function canonicalize(p: SignPayload): string {
  return `${p.achievementId}|${p.unlockedAt}|${p.scoreId ?? "null"}|${p.replayId ?? "null"}|${p.conditionType}|${p.satisfiedValue}`;
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "===".slice((b64.length + 3) % 4);
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export class AchievementSignerImpl implements AchievementSigner {
  private key: CryptoKey | null = null;

  async init(): Promise<void> {
    try {
      this.key = await getOrCreateHmacKey();
    } catch {
      this.key = null;
    }
  }

  async sign(payload: SignPayload): Promise<string> {
    if (!this.key) return "unsigned";
    const data = new TextEncoder().encode(canonicalize(payload));
    const sig = await crypto.subtle.sign("HMAC", this.key, data);
    return toBase64Url(sig);
  }

  async verify(payload: SignPayload, signature: string): Promise<boolean> {
    if (!this.key) return signature === "unsigned";
    if (signature === "unsigned") return false;
    const data = new TextEncoder().encode(canonicalize(payload));
    try {
      const sigBytes = fromBase64Url(signature);
      return await crypto.subtle.verify(
        "HMAC", this.key,
        new Uint8Array(sigBytes.buffer, sigBytes.byteOffset, sigBytes.byteLength) as Uint8Array<ArrayBuffer>,
        data,
      );
    } catch {
      return false;
    }
  }

  async deleteKey(): Promise<void> {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(HMAC_KEY_ID);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // ignore
    }
    this.key = null;
  }
}

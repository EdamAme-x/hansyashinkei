const DB_NAME = "device-keys";
const STORE_NAME = "keys";
const KEY_ID = "device-key";
const IV_LENGTH = 12; // AES-GCM uses 96-bit IV

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => {
      const db = req.result;
      // Close gracefully if another tab triggers a version upgrade.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getOrCreateKey(): Promise<CryptoKey> {
  const db = await openDb();

  // Single readwrite transaction to avoid race between tabs
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const existing = await new Promise<CryptoKey | undefined>(
    (resolve) => {
      const req = store.get(KEY_ID);
      req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
      req.onerror = () => resolve(undefined);
    },
  );

  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // extractable=false: cannot be exported from DevTools
    ["encrypt", "decrypt"],
  );

  store.put(key, KEY_ID);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return key;
}

export class DeviceKeyStore {
  private key: CryptoKey | null = null;

  async init(): Promise<void> {
    this.key = await getOrCreateKey();
  }

  async encrypt(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    if (!this.key) throw new Error("DeviceKeyStore not initialized");

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.key,
      data,
    );

    const result = new Uint8Array(IV_LENGTH + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), IV_LENGTH);
    return result;
  }

  async decrypt(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    if (!this.key) throw new Error("DeviceKeyStore not initialized");

    const iv = data.slice(0, IV_LENGTH);
    const encrypted = data.slice(IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      this.key,
      encrypted,
    );

    return new Uint8Array(decrypted);
  }
}

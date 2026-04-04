import { encode, decode } from "cbor-x";
import { deflate, inflate } from "pako";
import type { DeviceKeyStore } from "@infrastructure/crypto/DeviceKeyStore";
import { openGameDb } from "./gameDb";

type Pipeline = {
  encode(data: unknown): Uint8Array<ArrayBuffer>;
  decode(bytes: Uint8Array): unknown;
};

const PLAIN_PIPELINE: Pipeline = {
  encode(data) {
    const cbor = encode(data);
    return new Uint8Array(cbor.buffer, cbor.byteOffset, cbor.byteLength) as Uint8Array<ArrayBuffer>;
  },
  decode: (bytes) => decode(bytes),
};

const COMPRESSED_PIPELINE: Pipeline = {
  encode(data) {
    const cbor = encode(data);
    return deflate(
      new Uint8Array(cbor.buffer, cbor.byteOffset, cbor.byteLength),
    ) as Uint8Array<ArrayBuffer>;
  },
  decode: (bytes) => decode(inflate(bytes)),
};

function toBytes(data: ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> {
  if (data instanceof ArrayBuffer) return new Uint8Array(data) as Uint8Array<ArrayBuffer>;
  return new Uint8Array((data as Uint8Array).buffer) as Uint8Array<ArrayBuffer>;
}

export class EncryptedStore {
  constructor(
    private readonly storeName: string,
    private readonly crypto: DeviceKeyStore,
    private readonly compress = false,
  ) {}

  private async getDb(): Promise<IDBDatabase> {
    return openGameDb();
  }

  private pipeline(): Pipeline {
    return this.compress ? COMPRESSED_PIPELINE : PLAIN_PIPELINE;
  }

  async put<T extends { id: string }>(item: T): Promise<void> {
    const db = await this.getDb();
    const pipe = this.pipeline();
    const encrypted = await this.crypto.encrypt(pipe.encode(item));

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      tx.objectStore(this.storeName).put({ id: item.id, data: encrypted });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get<T>(id: string): Promise<T | null> {
    const db = await this.getDb();

    const record = await new Promise<{ id: string; data: ArrayBuffer } | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(this.storeName, "readonly");
        const req = tx.objectStore(this.storeName).get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      },
    );

    if (!record) return null;
    try {
      const pipe = this.pipeline();
      const decrypted = await this.crypto.decrypt(toBytes(record.data));
      return pipe.decode(decrypted) as T;
    } catch {
      return null;
    }
  }

  async getAll<T>(): Promise<T[]> {
    const db = await this.getDb();

    const records = await new Promise<{ id: string; data: ArrayBuffer }[]>(
      (resolve, reject) => {
        const tx = db.transaction(this.storeName, "readonly");
        const req = tx.objectStore(this.storeName).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      },
    );

    const pipe = this.pipeline();
    const items: T[] = [];
    for (const record of records) {
      try {
        const decrypted = await this.crypto.decrypt(toBytes(record.data));
        items.push(pipe.decode(decrypted) as T);
      } catch {
        // Skip records that can't be decrypted (e.g., corrupted or from a different key)
      }
    }
    return items;
  }

  async del(id: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      tx.objectStore(this.storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async delMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      for (const id of ids) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      tx.objectStore(this.storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

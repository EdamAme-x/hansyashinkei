import { encode, decode } from "cbor-x";
import type { Score } from "@domain/entities/Score";
import type { ScoreRepository } from "@domain/repositories/ScoreRepository";
import { DeviceKeyStore } from "@infrastructure/crypto/DeviceKeyStore";

const DB_NAME = "hansyashinkei";
const STORE_NAME = "scores";
const DB_VERSION = 1;

export class IndexedDbScoreRepository implements ScoreRepository {
  private db: IDBDatabase | null = null;
  private readonly crypto: DeviceKeyStore;

  constructor(crypto: DeviceKeyStore) {
    this.crypto = crypto;
  }

  private async getDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async save(score: Score): Promise<void> {
    const db = await this.getDb();
    const cbor = encode(score);
    const cborBytes = new Uint8Array(cbor.buffer, cbor.byteOffset, cbor.byteLength) as Uint8Array<ArrayBuffer>;
    const encrypted = await this.crypto.encrypt(cborBytes);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put({ id: score.id, data: encrypted });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAll(): Promise<Score[]> {
    const db = await this.getDb();

    const records = await new Promise<{ id: string; data: ArrayBuffer }[]>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      },
    );

    const scores: Score[] = [];
    for (const record of records) {
      const bytes = record.data instanceof ArrayBuffer
        ? new Uint8Array(record.data)
        : new Uint8Array((record.data as Uint8Array).buffer);
      const decrypted = await this.crypto.decrypt(bytes as Uint8Array<ArrayBuffer>);
      scores.push(decode(decrypted) as Score);
    }
    return scores;
  }

  async clear(): Promise<void> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

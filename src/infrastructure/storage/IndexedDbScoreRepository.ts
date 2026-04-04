import { encode, decode } from "cbor-x";
import type { Score } from "@domain/entities/Score";
import type { ScoreRepository } from "@domain/repositories/ScoreRepository";
import type { DeviceKeyStore } from "@infrastructure/crypto/DeviceKeyStore";
import { openGameDb } from "./gameDb";

const STORE_NAME = "scores";

export class IndexedDbScoreRepository implements ScoreRepository {
  constructor(private readonly crypto: DeviceKeyStore) {}

  private async getDb(): Promise<IDBDatabase> {
    return openGameDb();
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
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
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

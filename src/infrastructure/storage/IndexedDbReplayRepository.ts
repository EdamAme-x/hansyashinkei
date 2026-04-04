import { encode, decode } from "cbor-x";
import { deflate, inflate } from "pako";
import type { Replay } from "@domain/entities/Replay";
import type { ReplayRepository } from "@domain/repositories/ReplayRepository";
import type { DeviceKeyStore } from "@infrastructure/crypto/DeviceKeyStore";
import { openGameDb } from "./gameDb";

const STORE_NAME = "replays";

export class IndexedDbReplayRepository implements ReplayRepository {
  constructor(private readonly crypto: DeviceKeyStore) {}

  private async getDb(): Promise<IDBDatabase> {
    return openGameDb();
  }

  async save(replay: Replay): Promise<void> {
    const db = await this.getDb();
    const cbor = encode(replay);
    const compressed = deflate(
      new Uint8Array(cbor.buffer, cbor.byteOffset, cbor.byteLength),
    );
    const encrypted = await this.crypto.encrypt(
      compressed as Uint8Array<ArrayBuffer>,
    );

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put({ id: replay.id, data: encrypted });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getById(id: string): Promise<Replay | null> {
    const db = await this.getDb();

    const record = await new Promise<{ id: string; data: ArrayBuffer } | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      },
    );

    if (!record) return null;

    const bytes = record.data instanceof ArrayBuffer
      ? new Uint8Array(record.data)
      : new Uint8Array((record.data as Uint8Array).buffer);
    const decrypted = await this.crypto.decrypt(bytes as Uint8Array<ArrayBuffer>);
    const decompressed = inflate(decrypted);
    return decode(decompressed) as Replay;
  }

  async getAll(): Promise<Replay[]> {
    const db = await this.getDb();

    const records = await new Promise<{ id: string; data: ArrayBuffer }[]>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      },
    );

    const replays: Replay[] = [];
    for (const record of records) {
      const bytes = record.data instanceof ArrayBuffer
        ? new Uint8Array(record.data)
        : new Uint8Array((record.data as Uint8Array).buffer);
      const decrypted = await this.crypto.decrypt(bytes as Uint8Array<ArrayBuffer>);
      const decompressed = inflate(decrypted);
      replays.push(decode(decompressed) as Replay);
    }
    return replays;
  }

  async deleteById(id: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      for (const id of ids) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

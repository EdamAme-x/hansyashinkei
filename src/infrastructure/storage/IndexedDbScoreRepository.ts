import type { Score } from "@domain/entities/Score";
import type { ScoreRepository } from "@domain/repositories/ScoreRepository";
import type { DeviceKeyStore } from "@infrastructure/crypto/DeviceKeyStore";
import { EncryptedStore } from "./EncryptedStore";

export class IndexedDbScoreRepository implements ScoreRepository {
  private readonly store: EncryptedStore;

  constructor(crypto: DeviceKeyStore) {
    this.store = new EncryptedStore("scores", crypto);
  }

  async save(score: Score): Promise<void> {
    await this.store.put(score);
  }

  async getAll(): Promise<Score[]> {
    return this.store.getAll<Score>();
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }
}

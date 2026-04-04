import type { BestScoreRecord, BestScoreRepository } from "@domain/repositories/BestScoreRepository";
import type { DeviceKeyStore } from "@infrastructure/crypto/DeviceKeyStore";
import { EncryptedStore } from "./EncryptedStore";

const BEST_SCORE_ID = "best";

export class IndexedDbBestScoreRepository implements BestScoreRepository {
  private readonly store: EncryptedStore;

  constructor(crypto: DeviceKeyStore) {
    this.store = new EncryptedStore("meta", crypto);
  }

  async load(): Promise<BestScoreRecord | null> {
    try {
      return await this.store.get<BestScoreRecord & { id: string }>(BEST_SCORE_ID);
    } catch {
      return null;
    }
  }

  async save(record: BestScoreRecord): Promise<void> {
    await this.store.put({ id: BEST_SCORE_ID, ...record });
  }
}

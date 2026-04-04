import type { GameMode } from "@domain/entities/GameMode";
import type { BestScoreRecord, BestScoreRepository } from "@domain/repositories/BestScoreRepository";
import type { DeviceKeyStore } from "@infrastructure/crypto/DeviceKeyStore";
import { EncryptedStore } from "./EncryptedStore";

export class IndexedDbBestScoreRepository implements BestScoreRepository {
  private readonly store: EncryptedStore;

  constructor(crypto: DeviceKeyStore) {
    this.store = new EncryptedStore("meta", crypto);
  }

  async load(mode: GameMode): Promise<BestScoreRecord | null> {
    try {
      const record = await this.store.get<BestScoreRecord & { id: string }>(`best-${mode}`);
      if (record) return record;

      // Legacy migration: old "best" key → classic
      if (mode === "classic") {
        const legacy = await this.store.get<BestScoreRecord & { id: string }>("best");
        if (legacy) {
          await this.save("classic", legacy);
          return legacy;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async save(mode: GameMode, record: BestScoreRecord): Promise<void> {
    await this.store.put({ id: `best-${mode}`, ...record });
  }
}

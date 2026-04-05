import type { AchievementRecord, ActiveSkinSetting } from "@domain/entities/Achievement";
import type { AchievementRepository } from "@domain/repositories/AchievementRepository";
import type { DeviceKeyStore } from "@infrastructure/crypto/DeviceKeyStore";
import { EncryptedStore } from "./EncryptedStore";

export class IndexedDbAchievementRepository implements AchievementRepository {
  private readonly store: EncryptedStore;

  constructor(crypto: DeviceKeyStore) {
    this.store = new EncryptedStore("achievements", crypto);
  }

  async save(record: AchievementRecord): Promise<void> {
    await this.store.put(record);
  }

  async getAll(): Promise<AchievementRecord[]> {
    return this.store.getAll<AchievementRecord>();
  }

  async getById(id: string): Promise<AchievementRecord | null> {
    return this.store.get<AchievementRecord>(id);
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }

  async saveActiveSkin(setting: ActiveSkinSetting): Promise<void> {
    await this.store.put(setting);
  }

  async loadActiveSkin(): Promise<ActiveSkinSetting | null> {
    return this.store.get<ActiveSkinSetting>("active-skin");
  }
}

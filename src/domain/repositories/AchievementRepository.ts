import type { AchievementRecord, ActiveSkinSetting } from "@domain/entities/Achievement";

export interface AchievementRepository {
  save(record: AchievementRecord): Promise<void>;
  getAll(): Promise<AchievementRecord[]>;
  getById(id: string): Promise<AchievementRecord | null>;
  clear(): Promise<void>;
  saveActiveSkin(setting: ActiveSkinSetting): Promise<void>;
  loadActiveSkin(): Promise<ActiveSkinSetting | null>;
}

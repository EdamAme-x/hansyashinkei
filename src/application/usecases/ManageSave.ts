import type { ScoreRepository } from "@domain/repositories/ScoreRepository";
import type { ReplayRepository } from "@domain/repositories/ReplayRepository";
import type { BestScoreRepository } from "@domain/repositories/BestScoreRepository";
import type { AchievementRecord } from "@domain/entities/Achievement";
import type { SaveData, SettingsData } from "@domain/entities/SaveData";
import { SAVE_VERSION, isSaveData, isSettingsData, canMigrate, migrate } from "@domain/entities/SaveData";
import type { CustomThemeOverrides } from "@domain/entities/ThemeConfig";
import { createEmptyOverrides } from "@domain/entities/ThemeConfig";
import type { GameMode } from "@domain/entities/GameMode";
import type { SaveSerializer } from "@domain/repositories/SaveSerializer";
export type { SaveSerializer } from "@domain/repositories/SaveSerializer";

export interface SaveExternals {
  scoreRepo: ScoreRepository;
  replayRepo: ReplayRepository;
  bestScoreRepo: BestScoreRepository;
  loadThemeOverrides(): CustomThemeOverrides;
  saveThemeOverrides(o: CustomThemeOverrides): void;
  loadImages(): Promise<{ bg: string | null; wall: string | null }>;
  saveImage(key: string, dataUrl: string): Promise<void>;
  removeImage(key: string): Promise<void>;
  loadKeybinds(): { code: string; ballIndex: number }[];
  saveKeybinds(binds: { code: string; ballIndex: number }[]): void;
  loadAudioEnabled(): boolean;
  saveAudioEnabled(v: boolean): void;
  // v3: achievements
  loadAchievements(): Promise<AchievementRecord[]>;
  importAndResignAchievements(records: AchievementRecord[]): Promise<void>;
  loadActiveSkinId(): Promise<string>;
  saveActiveSkinId(skinId: string): Promise<void>;
  clearAchievements(): Promise<void>;
  /** Destroy ALL browser data (IDB + localStorage + crypto keys). Called after full migration export. */
  nukeAllData(): Promise<void>;
}

const ALL_MODES: GameMode[] = ["classic", "triple"];

export class ManageSave {
  constructor(
    private readonly ext: SaveExternals,
    private readonly serializer: SaveSerializer,
  ) {}

  /** Full migration export — returns bytes. Caller downloads, then calls `nukeAfterExport()`. */
  async exportSave(): Promise<Uint8Array> {
    const scores = await this.ext.scoreRepo.getAll();
    const replays = await this.ext.replayRepo.getAll();

    const bestScores: Partial<Record<GameMode, import("@domain/repositories/BestScoreRepository").BestScoreRecord | null>> = {};
    for (const mode of ALL_MODES) {
      bestScores[mode] = await this.ext.bestScoreRepo.load(mode);
    }

    const themeOverrides = this.ext.loadThemeOverrides();
    const images = await this.ext.loadImages();
    const keybinds = this.ext.loadKeybinds();
    const audioEnabled = this.ext.loadAudioEnabled();
    const achievements = await this.ext.loadAchievements();
    const activeSkinId = await this.ext.loadActiveSkinId();

    const data: SaveData = {
      version: SAVE_VERSION,
      exportedAt: Date.now(),
      scores,
      replays,
      bestScores,
      themeOverrides,
      images,
      keybinds,
      audioEnabled,
      achievements,
      activeSkinId,
    };

    return this.serializer.encode(data);
  }

  /** Destroy all browser data after migration export has been downloaded. */
  async nukeAfterExport(): Promise<void> {
    await this.ext.nukeAllData();
  }

  /** Settings-only export — no scores, replays, or achievements. No data destruction. */
  async exportSettings(): Promise<Uint8Array> {
    const themeOverrides = this.ext.loadThemeOverrides();
    const images = await this.ext.loadImages();
    const keybinds = this.ext.loadKeybinds();
    const audioEnabled = this.ext.loadAudioEnabled();

    const data: SettingsData = {
      type: "settings",
      version: SAVE_VERSION,
      exportedAt: Date.now(),
      themeOverrides,
      images,
      keybinds,
      audioEnabled,
    };

    return this.serializer.encode(data as unknown as SaveData);
  }

  async importSave(raw: Uint8Array): Promise<{ success: boolean; error?: string }> {
    const parsed = this.serializer.decode(raw);
    if (!parsed) return { success: false, error: "Invalid file format" };

    // Settings-only import
    if (isSettingsData(parsed)) {
      return this.importSettings(parsed);
    }

    if (!isSaveData(parsed)) return { success: false, error: "Corrupt save data" };
    if (!canMigrate(parsed.version)) return { success: false, error: `Unsupported version: v${parsed.version}` };

    const data = migrate(parsed);

    // Scores
    await this.ext.scoreRepo.clear();
    for (const score of data.scores) {
      await this.ext.scoreRepo.save(score);
    }

    // Replays
    const existing = await this.ext.replayRepo.getAll();
    for (const r of existing) await this.ext.replayRepo.deleteById(r.id);
    for (const replay of data.replays) {
      await this.ext.replayRepo.save(replay);
    }

    // Best scores (per-mode)
    for (const mode of ALL_MODES) {
      const record = data.bestScores?.[mode];
      if (record) {
        await this.ext.bestScoreRepo.save(mode, record);
      }
    }

    // Theme overrides
    this.ext.saveThemeOverrides(data.themeOverrides ?? createEmptyOverrides());

    // Images
    if (data.images?.bg) {
      await this.ext.saveImage("bg", data.images.bg);
    } else {
      await this.ext.removeImage("bg");
    }
    if (data.images?.wall) {
      await this.ext.saveImage("wall", data.images.wall);
    } else {
      await this.ext.removeImage("wall");
    }

    // Keybinds
    if (data.keybinds?.length) {
      this.ext.saveKeybinds(data.keybinds);
    }

    // Audio
    if (typeof data.audioEnabled === "boolean") {
      this.ext.saveAudioEnabled(data.audioEnabled);
    }

    // Achievements: re-sign with this device's HMAC key
    await this.ext.clearAchievements();
    if (data.achievements?.length) {
      await this.ext.importAndResignAchievements(data.achievements);
    }
    if (data.activeSkinId) {
      await this.ext.saveActiveSkinId(data.activeSkinId);
    }

    return { success: true };
  }

  private async importSettings(data: SettingsData): Promise<{ success: boolean; error?: string }> {
    this.ext.saveThemeOverrides(data.themeOverrides ?? createEmptyOverrides());

    if (data.images?.bg) {
      await this.ext.saveImage("bg", data.images.bg);
    } else {
      await this.ext.removeImage("bg");
    }
    if (data.images?.wall) {
      await this.ext.saveImage("wall", data.images.wall);
    } else {
      await this.ext.removeImage("wall");
    }

    if (data.keybinds?.length) {
      this.ext.saveKeybinds(data.keybinds);
    }

    if (typeof data.audioEnabled === "boolean") {
      this.ext.saveAudioEnabled(data.audioEnabled);
    }

    return { success: true };
  }
}

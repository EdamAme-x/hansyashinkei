import type { ScoreRepository } from "@domain/repositories/ScoreRepository";
import type { ReplayRepository } from "@domain/repositories/ReplayRepository";
import type { BestScoreRepository } from "@domain/repositories/BestScoreRepository";
import type { SaveData } from "@domain/entities/SaveData";
import { SAVE_VERSION, isSaveData, canMigrate, migrate } from "@domain/entities/SaveData";
import type { CustomThemeOverrides } from "@domain/entities/ThemeConfig";
import { createEmptyOverrides } from "@domain/entities/ThemeConfig";

export interface SaveSerializer {
  encode(data: SaveData): Uint8Array;
  decode(raw: Uint8Array): SaveData | null;
}

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
}

export class ManageSave {
  constructor(
    private readonly ext: SaveExternals,
    private readonly serializer: SaveSerializer,
  ) {}

  async exportSave(): Promise<Uint8Array> {
    const scores = await this.ext.scoreRepo.getAll();
    const replays = await this.ext.replayRepo.getAll();
    const bestScore = await this.ext.bestScoreRepo.load();
    const themeOverrides = this.ext.loadThemeOverrides();
    const images = await this.ext.loadImages();
    const keybinds = this.ext.loadKeybinds();
    const audioEnabled = this.ext.loadAudioEnabled();

    const data: SaveData = {
      version: SAVE_VERSION,
      exportedAt: Date.now(),
      scores,
      replays,
      bestScore,
      themeOverrides,
      images,
      keybinds,
      audioEnabled,
    };

    return this.serializer.encode(data);
  }

  async importSave(raw: Uint8Array): Promise<{ success: boolean; error?: string }> {
    const parsed = this.serializer.decode(raw);
    if (!parsed) return { success: false, error: "Invalid file format" };
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

    // Best score
    if (data.bestScore) {
      await this.ext.bestScoreRepo.save(data.bestScore);
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

    return { success: true };
  }
}

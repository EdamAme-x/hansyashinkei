import type { Score } from "./Score";
import type { Replay } from "./Replay";
import type { BestScoreRecord } from "@domain/repositories/BestScoreRepository";
import type { CustomThemeOverrides } from "./ThemeConfig";
import type { GameMode } from "./GameMode";
import type { AchievementRecord } from "./Achievement";

export const SAVE_VERSION = 3;

export interface SaveData {
  readonly version: number;
  readonly exportedAt: number;
  readonly scores: Score[];
  readonly replays: Replay[];
  readonly bestScores: Partial<Record<GameMode, BestScoreRecord | null>>;
  readonly themeOverrides: CustomThemeOverrides;
  readonly images: { bg: string | null; wall: string | null };
  readonly keybinds: { code: string; ballIndex: number }[];
  readonly audioEnabled: boolean;
  // v3
  readonly achievements: AchievementRecord[];
  readonly activeSkinId: string;
}

/** Lightweight settings-only export (no scores/replays/achievements). */
export interface SettingsData {
  readonly type: "settings";
  readonly version: number;
  readonly exportedAt: number;
  readonly themeOverrides: CustomThemeOverrides;
  readonly images: { bg: string | null; wall: string | null };
  readonly keybinds: { code: string; ballIndex: number }[];
  readonly audioEnabled: boolean;
}

export function isSaveData(obj: unknown): obj is SaveData {
  if (obj == null || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.version === "number" &&
    typeof o.exportedAt === "number" &&
    Array.isArray(o.scores) &&
    Array.isArray(o.replays)
  );
}

export function isSettingsData(obj: unknown): obj is SettingsData {
  if (obj == null || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return o.type === "settings" && typeof o.version === "number";
}

export function canMigrate(version: number): boolean {
  return version >= 1 && version <= SAVE_VERSION;
}

export function migrate(data: SaveData): SaveData {
  let d = { ...data };

  // v1 → v2: bestScore (single) → bestScores (per-mode)
  if (d.version < 2) {
    const legacy = (d as unknown as { bestScore?: BestScoreRecord | null }).bestScore;
    d = {
      ...d,
      bestScores: { classic: legacy ?? null },
    };
    // Tag old scores as classic
    d = {
      ...d,
      scores: d.scores.map((s) => (s.mode ? s : { ...s, mode: "classic" as GameMode })),
    };
  }

  // v2 → v3: achievements + activeSkinId
  if (d.version < 3) {
    d = {
      ...d,
      achievements: (d as Partial<SaveData>).achievements ?? [],
      activeSkinId: (d as Partial<SaveData>).activeSkinId ?? "skin_default",
    };
  }

  return { ...d, version: SAVE_VERSION };
}

import type { Score } from "./Score";
import type { Replay } from "./Replay";
import type { BestScoreRecord } from "@domain/repositories/BestScoreRepository";
import type { CustomThemeOverrides } from "./ThemeConfig";

export const SAVE_VERSION = 1;

export interface SaveData {
  readonly version: number;
  readonly exportedAt: number;
  readonly scores: Score[];
  readonly replays: Replay[];
  readonly bestScore: BestScoreRecord | null;
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

export function canMigrate(version: number): boolean {
  return version >= 1 && version <= SAVE_VERSION;
}

export function migrate(data: SaveData): SaveData {
  // Future: add migration steps here
  // if (data.version < 2) { ... }
  return { ...data, version: SAVE_VERSION };
}

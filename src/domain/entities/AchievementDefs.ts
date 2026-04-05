import type { AchievementDef } from "./Achievement";

export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  // ── Classic score ──
  {
    id: "classic_50",
    label: "FIRST STEP",
    description: "Score 50 in Classic",
    condition: { type: "score_classic", threshold: 50 },
    rewardSkinId: "skin_crimson",
    hidden: false,
  },
  {
    id: "classic_150",
    label: "CENTURION",
    description: "Score 150 in Classic",
    condition: { type: "score_classic", threshold: 150 },
    rewardSkinId: "skin_gold",
    hidden: false,
  },
  {
    id: "classic_300",
    label: "MASTER",
    description: "Score 300 in Classic",
    condition: { type: "score_classic", threshold: 300 },
    rewardSkinId: "skin_plasma",
    hidden: false,
  },
  {
    id: "classic_500",
    label: "LEGEND",
    description: "Score 500 in Classic",
    condition: { type: "score_classic", threshold: 500 },
    rewardSkinId: "skin_obsidian",
    hidden: true,
  },

  // ── Triple score ──
  {
    id: "triple_30",
    label: "TRI-RUNNER",
    description: "Score 30 in Triple",
    condition: { type: "score_triple", threshold: 30 },
    rewardSkinId: "skin_cobalt",
    hidden: false,
  },
  {
    id: "triple_100",
    label: "TRI-MASTER",
    description: "Score 100 in Triple",
    condition: { type: "score_triple", threshold: 100 },
    rewardSkinId: "skin_aurora",
    hidden: false,
  },

  // ── Any mode score ──
  {
    id: "any_200",
    label: "REFLEXMASTER",
    description: "Score 200 in any mode",
    condition: { type: "score_any_mode", threshold: 200 },
    rewardSkinId: "skin_neon",
    hidden: true,
  },

  // ── Total plays ──
  {
    id: "plays_10",
    label: "REGULAR",
    description: "Play 10 games",
    condition: { type: "total_plays", threshold: 10 },
    rewardSkinId: "skin_jade",
    hidden: false,
  },
  {
    id: "plays_100",
    label: "VETERAN",
    description: "Play 100 games",
    condition: { type: "total_plays", threshold: 100 },
    rewardSkinId: "skin_chrome",
    hidden: false,
  },

  // ── Win streak ──
  {
    id: "streak_classic_3",
    label: "STREAK",
    description: "Score 30+ three times in a row (Classic)",
    condition: { type: "win_streak", minScore: 30, count: 3, mode: "classic" },
    rewardSkinId: "skin_fire",
    hidden: false,
  },

  // ── Total score sum ──
  {
    id: "total_1000",
    label: "ACCUMULATOR",
    description: "Total score across all games reaches 1000",
    condition: { type: "total_score_sum", threshold: 1000 },
    rewardSkinId: "skin_cube",
    hidden: false,
  },
];

export function getAchievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENT_DEFS.find((d) => d.id === id);
}

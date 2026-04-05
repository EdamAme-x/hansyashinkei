import type { AchievementDef } from "./Achievement";

export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  // ── Classic score ──
  {
    id: "classic_50",
    label: "FIRST STEP",
    description: "クラシックで50点を達成",
    condition: { type: "score_classic", threshold: 50 },
    rewardSkinId: "skin_crimson",
    hidden: false,
  },
  {
    id: "classic_150",
    label: "CENTURION",
    description: "クラシックで150点を達成",
    condition: { type: "score_classic", threshold: 150 },
    rewardSkinId: "skin_gold",
    hidden: false,
  },
  {
    id: "classic_300",
    label: "MASTER",
    description: "クラシックで300点を達成",
    condition: { type: "score_classic", threshold: 300 },
    rewardSkinId: "skin_plasma",
    hidden: false,
  },
  {
    id: "classic_500",
    label: "LEGEND",
    description: "クラシックで500点を達成",
    condition: { type: "score_classic", threshold: 500 },
    rewardSkinId: "skin_obsidian",
    hidden: true,
  },

  // ── Triple score ──
  {
    id: "triple_30",
    label: "TRI-RUNNER",
    description: "トリプルで30点を達成",
    condition: { type: "score_triple", threshold: 30 },
    rewardSkinId: "skin_cobalt",
    hidden: false,
  },
  {
    id: "triple_100",
    label: "TRI-MASTER",
    description: "トリプルで100点を達成",
    condition: { type: "score_triple", threshold: 100 },
    rewardSkinId: "skin_aurora",
    hidden: false,
  },

  // ── Any mode score ──
  {
    id: "any_200",
    label: "REFLEXMASTER",
    description: "いずれかのモードで200点を達成",
    condition: { type: "score_any_mode", threshold: 200 },
    rewardSkinId: "skin_neon",
    hidden: true,
  },

  // ── Total plays ──
  {
    id: "plays_10",
    label: "REGULAR",
    description: "10回プレイする",
    condition: { type: "total_plays", threshold: 10 },
    rewardSkinId: "skin_jade",
    hidden: false,
  },
  {
    id: "plays_100",
    label: "VETERAN",
    description: "100回プレイする",
    condition: { type: "total_plays", threshold: 100 },
    rewardSkinId: "skin_chrome",
    hidden: false,
  },

  // ── Win streak ──
  {
    id: "streak_classic_3",
    label: "STREAK",
    description: "クラシックで30点以上を3連続達成",
    condition: { type: "win_streak", minScore: 30, count: 3, mode: "classic" },
    rewardSkinId: "skin_fire",
    hidden: false,
  },

  // ── Total score sum ──
  {
    id: "total_1000",
    label: "ACCUMULATOR",
    description: "全ゲームの累計スコアが1000に到達",
    condition: { type: "total_score_sum", threshold: 1000 },
    rewardSkinId: "skin_cube",
    hidden: false,
  },
];

export function getAchievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENT_DEFS.find((d) => d.id === id);
}

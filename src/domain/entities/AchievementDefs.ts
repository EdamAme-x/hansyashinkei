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

  // ── Exact score (hidden) ──
  {
    id: "exact_42",
    label: "THE ANSWER",
    description: "スコアぴったり42で死ぬ",
    condition: { type: "exact_score", value: 42 },
    rewardSkinId: "skin_galaxy",
    hidden: true,
  },
  {
    id: "exact_69",
    label: "NICE",
    description: "スコアぴったり69で死ぬ",
    condition: { type: "exact_score", value: 69 },
    rewardSkinId: "skin_rose",
    hidden: true,
  },
  {
    id: "exact_314",
    label: "PI",
    description: "スコアぴったり314で死ぬ",
    condition: { type: "exact_score", value: 314 },
    rewardSkinId: "skin_pi",
    hidden: true,
  },
  {
    id: "exact_777",
    label: "JACKPOT",
    description: "スコアぴったり777で死ぬ",
    condition: { type: "exact_score", value: 777 },
    rewardSkinId: "skin_jackpot",
    hidden: true,
  },

  // ── Stub: condition TBD ──
  {
    id: "invisible",
    label: "INVISIBLE",
    description: "???",
    condition: { type: "exact_score", value: -1 }, // unreachable stub
    rewardSkinId: "skin_invisible",
    hidden: true,
  },

  // ── Rapid key presses (hidden) ──
  {
    id: "adhd",
    label: "THE ADHD",
    description: "1秒間に3回以上キーを押してから死ぬ",
    condition: { type: "rapid_keys", keysPerSecond: 3 },
    rewardSkinId: "skin_adhd",
    hidden: true,
  },
  {
    id: "hyper_adhd",
    label: "HYPER ADHD",
    description: "1秒間に7回以上キーを押してから死ぬ",
    condition: { type: "rapid_keys", keysPerSecond: 7 },
    rewardSkinId: "skin_hyper_adhd",
    hidden: true,
  },
  {
    id: "ultra_luckyboy",
    label: "ULTRA LUCKYBOY",
    description: "プレイ後に1/1000の確率で出現",
    condition: { type: "random_chance", denominator: 1000 },
    rewardSkinId: "skin_luckyboy",
    hidden: true,
  },
];

export function getAchievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENT_DEFS.find((d) => d.id === id);
}

import type { GameMode } from "./GameMode";

// ── Ball shape variants ──

export type BallShape = "sphere" | "cube" | "spiky";

// ── Skin definition (reward for unlocking an achievement) ──

export interface AchievementSkin {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly shape: BallShape;
  readonly color: number;
  readonly metalness: number;
  readonly roughness: number;
  readonly emissiveColor: number;
  readonly emissiveIntensity: number;
  readonly glowColor: number;
  readonly glowIntensity: number;
  readonly pulseSpeed: number; // 0 = no pulse
}

// ── Achievement condition (discriminated union — extensible via new `type` variants) ──

export type AchievementCondition =
  | { readonly type: "score_classic"; readonly threshold: number }
  | { readonly type: "score_triple"; readonly threshold: number }
  | { readonly type: "score_any_mode"; readonly threshold: number }
  | { readonly type: "total_plays"; readonly threshold: number }
  | { readonly type: "total_score_sum"; readonly threshold: number }
  | { readonly type: "win_streak"; readonly minScore: number; readonly count: number; readonly mode?: GameMode };

// ── Achievement definition (static master data) ──

export interface AchievementDef {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly condition: AchievementCondition;
  readonly rewardSkinId: string;
  readonly hidden: boolean; // hidden achievements show "???" until unlocked
}

// ── Unlock proof (signed with device HMAC key) ──

export interface AchievementConditionSnapshot {
  readonly type: string;
  readonly satisfiedValue: number;
}

export interface UnlockProof {
  readonly achievementId: string;
  readonly unlockedAt: number;
  readonly scoreId: string | null;
  readonly replayId: string | null;
  readonly conditionSnapshot: AchievementConditionSnapshot;
  readonly signature: string; // HMAC-SHA256 base64url, or "unsigned" when crypto unavailable
}

// ── Persisted record (one per unlocked achievement) ──

export interface AchievementRecord {
  readonly id: string; // same as achievementDef.id — used as IDB keyPath
  readonly proof: UnlockProof;
  readonly verified: boolean;
}

// ── Active skin selection ──

export interface ActiveSkinSetting {
  readonly id: "active-skin";
  readonly skinId: string;
}

import { describe, it, expect } from "vitest";
import { evaluateAchievements } from "@domain/entities/AchievementEvaluator";
import type { AchievementDef } from "@domain/entities/Achievement";
import type { Score } from "@domain/entities/Score";

function score(id: string, value: number, mode: "classic" | "triple" = "classic", replayId: string | null = null): Score {
  return { id, value, timestamp: Date.now(), replayId, mode };
}

const CLASSIC_50: AchievementDef = {
  id: "c50", label: "C50", description: "", hidden: false,
  condition: { type: "score_classic", threshold: 50 },
  rewardSkinId: "skin_a",
};

const TRIPLE_30: AchievementDef = {
  id: "t30", label: "T30", description: "", hidden: false,
  condition: { type: "score_triple", threshold: 30 },
  rewardSkinId: "skin_b",
};

const ANY_100: AchievementDef = {
  id: "any100", label: "ANY100", description: "", hidden: false,
  condition: { type: "score_any_mode", threshold: 100 },
  rewardSkinId: "skin_c",
};

const PLAYS_3: AchievementDef = {
  id: "p3", label: "P3", description: "", hidden: false,
  condition: { type: "total_plays", threshold: 3 },
  rewardSkinId: "skin_d",
};

const SUM_100: AchievementDef = {
  id: "sum100", label: "SUM100", description: "", hidden: false,
  condition: { type: "total_score_sum", threshold: 100 },
  rewardSkinId: "skin_e",
};

const STREAK_3: AchievementDef = {
  id: "str3", label: "STR3", description: "", hidden: false,
  condition: { type: "win_streak", minScore: 20, count: 3, mode: "classic" },
  rewardSkinId: "skin_f",
};

const EXACT_42: AchievementDef = {
  id: "e42", label: "E42", description: "", hidden: true,
  condition: { type: "exact_score", value: 42 },
  rewardSkinId: "skin_g",
};

const ALL_DEFS = [CLASSIC_50, TRIPLE_30, ANY_100, PLAYS_3, SUM_100, STREAK_3, EXACT_42];

describe("evaluateAchievements", () => {
  it("returns nothing when no conditions are met", () => {
    const s = score("s1", 10);
    const results = evaluateAchievements(ALL_DEFS, {
      scores: [s], newScore: s, alreadyUnlocked: new Set(),
    });
    expect(results).toHaveLength(0);
  });

  it("unlocks score_classic when threshold is met", () => {
    const s = score("s1", 60, "classic", "r1");
    const results = evaluateAchievements(ALL_DEFS, {
      scores: [s], newScore: s, alreadyUnlocked: new Set(),
    });
    const ids = results.map((r) => r.defId);
    expect(ids).toContain("c50");
    const c50 = results.find((r) => r.defId === "c50");
    expect(c50).toBeDefined();
    expect(c50?.scoreId).toBe("s1");
    expect(c50?.replayId).toBe("r1");
    expect(c50?.snapshot.satisfiedValue).toBe(60);
  });

  it("does not unlock score_classic for triple mode score", () => {
    const s = score("s1", 60, "triple");
    const results = evaluateAchievements([CLASSIC_50], {
      scores: [s], newScore: s, alreadyUnlocked: new Set(),
    });
    expect(results).toHaveLength(0);
  });

  it("unlocks score_triple", () => {
    const s = score("s1", 35, "triple");
    const results = evaluateAchievements([TRIPLE_30], {
      scores: [s], newScore: s, alreadyUnlocked: new Set(),
    });
    expect(results).toHaveLength(1);
    expect(results[0].defId).toBe("t30");
  });

  it("unlocks score_any_mode for either mode", () => {
    const s = score("s1", 150, "triple");
    const results = evaluateAchievements([ANY_100], {
      scores: [s], newScore: s, alreadyUnlocked: new Set(),
    });
    expect(results).toHaveLength(1);
  });

  it("unlocks total_plays when count is reached", () => {
    const s1 = score("s1", 10);
    const s2 = score("s2", 20);
    const s3 = score("s3", 5);
    const results = evaluateAchievements([PLAYS_3], {
      scores: [s1, s2, s3], newScore: s3, alreadyUnlocked: new Set(),
    });
    expect(results).toHaveLength(1);
    expect(results[0].snapshot.satisfiedValue).toBe(3);
  });

  it("unlocks total_score_sum", () => {
    const s1 = score("s1", 40);
    const s2 = score("s2", 70);
    const results = evaluateAchievements([SUM_100], {
      scores: [s1, s2], newScore: s2, alreadyUnlocked: new Set(),
    });
    expect(results).toHaveLength(1);
    expect(results[0].snapshot.satisfiedValue).toBe(110);
  });

  it("unlocks win_streak when recent games all meet threshold", () => {
    const now = Date.now();
    const s1: Score = { id: "s1", value: 25, timestamp: now - 2000, replayId: null, mode: "classic" };
    const s2: Score = { id: "s2", value: 30, timestamp: now - 1000, replayId: null, mode: "classic" };
    const s3: Score = { id: "s3", value: 22, timestamp: now, replayId: null, mode: "classic" };
    const results = evaluateAchievements([STREAK_3], {
      scores: [s1, s2, s3], newScore: s3, alreadyUnlocked: new Set(),
    });
    expect(results).toHaveLength(1);
    expect(results[0].snapshot.satisfiedValue).toBe(3);
  });

  it("does not unlock win_streak when broken by a low score", () => {
    const now = Date.now();
    const s1: Score = { id: "s1", value: 25, timestamp: now - 2000, replayId: null, mode: "classic" };
    const s2: Score = { id: "s2", value: 5, timestamp: now - 1000, replayId: null, mode: "classic" };
    const s3: Score = { id: "s3", value: 30, timestamp: now, replayId: null, mode: "classic" };
    const results = evaluateAchievements([STREAK_3], {
      scores: [s1, s2, s3], newScore: s3, alreadyUnlocked: new Set(),
    });
    expect(results).toHaveLength(0);
  });

  it("skips already-unlocked achievements", () => {
    const s = score("s1", 60, "classic");
    const results = evaluateAchievements([CLASSIC_50], {
      scores: [s], newScore: s, alreadyUnlocked: new Set(["c50"]),
    });
    expect(results).toHaveLength(0);
  });

  it("can unlock multiple achievements at once", () => {
    const s = score("s1", 200, "classic");
    const results = evaluateAchievements([CLASSIC_50, ANY_100], {
      scores: [s], newScore: s, alreadyUnlocked: new Set(),
    });
    expect(results).toHaveLength(2);
  });

  it("unlocks exact_score when score matches exactly", () => {
    const s = score("s1", 42);
    const results = evaluateAchievements([EXACT_42], {
      scores: [s], newScore: s, alreadyUnlocked: new Set(),
    });
    expect(results).toHaveLength(1);
    expect(results[0].defId).toBe("e42");
  });

  it("does not unlock exact_score when score differs", () => {
    const s = score("s1", 43);
    const results = evaluateAchievements([EXACT_42], {
      scores: [s], newScore: s, alreadyUnlocked: new Set(),
    });
    expect(results).toHaveLength(0);
  });
});

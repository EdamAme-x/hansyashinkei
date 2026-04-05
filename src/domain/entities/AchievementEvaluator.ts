import type { Score } from "./Score";
import type { GameMode } from "./GameMode";
import type { AchievementDef, AchievementConditionSnapshot } from "./Achievement";

export interface EvalContext {
  /** All scores including the one just recorded. */
  readonly scores: readonly Score[];
  /** The score that was just recorded (already included in `scores`). */
  readonly newScore: Score;
  /** IDs of achievements already unlocked. */
  readonly alreadyUnlocked: ReadonlySet<string>;
  /** Max dodge key presses per second during this game (for rapid_keys condition). */
  readonly maxKeysPerSecond?: number;
}

export interface EvalResult {
  readonly defId: string;
  readonly scoreId: string | null;
  readonly replayId: string | null;
  readonly snapshot: AchievementConditionSnapshot;
}

export function evaluateAchievements(
  defs: readonly AchievementDef[],
  ctx: EvalContext,
): EvalResult[] {
  const results: EvalResult[] = [];
  for (const def of defs) {
    if (ctx.alreadyUnlocked.has(def.id)) continue;
    const r = checkCondition(def, ctx);
    if (r) results.push(r);
  }
  return results;
}

function checkCondition(def: AchievementDef, ctx: EvalContext): EvalResult | null {
  const { condition } = def;
  const { scores, newScore } = ctx;

  switch (condition.type) {
    case "score_classic": {
      if (scoreMode(newScore) !== "classic") return null;
      if (newScore.value < condition.threshold) return null;
      return scoreResult(def.id, newScore, condition.type, newScore.value);
    }

    case "score_triple": {
      if (scoreMode(newScore) !== "triple") return null;
      if (newScore.value < condition.threshold) return null;
      return scoreResult(def.id, newScore, condition.type, newScore.value);
    }

    case "score_any_mode": {
      if (newScore.value < condition.threshold) return null;
      return scoreResult(def.id, newScore, condition.type, newScore.value);
    }

    case "total_plays": {
      if (scores.length < condition.threshold) return null;
      return aggregateResult(def.id, condition.type, scores.length);
    }

    case "total_score_sum": {
      const sum = scores.reduce((acc, s) => acc + s.value, 0);
      if (sum < condition.threshold) return null;
      return aggregateResult(def.id, condition.type, sum);
    }

    case "win_streak": {
      const mode: GameMode | undefined = condition.mode;
      const filtered = [...scores]
        .filter((s) => !mode || scoreMode(s) === mode)
        .sort((a, b) => b.timestamp - a.timestamp);

      let streak = 0;
      for (const s of filtered) {
        if (s.value >= condition.minScore) streak++;
        else break;
      }
      if (streak < condition.count) return null;
      return scoreResult(def.id, newScore, condition.type, streak);
    }

    case "exact_score": {
      if (newScore.value !== condition.value) return null;
      return scoreResult(def.id, newScore, condition.type, newScore.value);
    }

    case "rapid_keys": {
      const kps = ctx.maxKeysPerSecond ?? 0;
      if (kps < condition.keysPerSecond) return null;
      return scoreResult(def.id, newScore, condition.type, kps);
    }

    case "random_chance": {
      if (Math.random() * condition.denominator >= 1) return null;
      return scoreResult(def.id, newScore, condition.type, 1);
    }
  }
}

function scoreMode(s: Score): GameMode {
  return s.mode ?? "classic";
}

function scoreResult(
  defId: string,
  score: Score,
  type: string,
  value: number,
): EvalResult {
  return {
    defId,
    scoreId: score.id,
    replayId: score.replayId,
    snapshot: { type, satisfiedValue: value },
  };
}

function aggregateResult(
  defId: string,
  type: string,
  value: number,
): EvalResult {
  return {
    defId,
    scoreId: null,
    replayId: null,
    snapshot: { type, satisfiedValue: value },
  };
}

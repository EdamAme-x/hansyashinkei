import type { GameMode } from "./GameMode";

export interface Score {
  readonly id: string;
  readonly value: number;
  readonly timestamp: number;
  readonly replayId: string | null;
  readonly mode?: GameMode;
}

export interface ScoreHistory {
  readonly scores: Score[];
  readonly bestScore: Score | null;
}

export function createScore(
  id: string,
  value: number,
  mode: GameMode,
  replayId: string | null = null,
): Score {
  return { id, value, timestamp: Date.now(), replayId, mode };
}

export function buildHistory(scores: Score[]): ScoreHistory {
  const sorted = [...scores].sort((a, b) => b.timestamp - a.timestamp);
  const bestScore =
    sorted.length > 0
      ? sorted.reduce((best, s) => (s.value > best.value ? s : best))
      : null;
  return { scores: sorted, bestScore };
}

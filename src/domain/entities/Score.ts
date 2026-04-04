export interface Score {
  readonly id: string;
  readonly value: number;
  readonly timestamp: number;
}

export interface ScoreHistory {
  readonly scores: Score[];
  readonly bestScore: Score | null;
}

export function createScore(id: string, value: number): Score {
  return { id, value, timestamp: Date.now() };
}

export function buildHistory(scores: Score[]): ScoreHistory {
  const sorted = [...scores].sort((a, b) => b.timestamp - a.timestamp);
  const bestScore =
    sorted.length > 0
      ? sorted.reduce((best, s) => (s.value > best.value ? s : best))
      : null;
  return { scores: sorted, bestScore };
}

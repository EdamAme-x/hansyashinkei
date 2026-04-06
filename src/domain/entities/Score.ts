import type { GameMode } from "./GameMode";

export interface SoloScore {
  readonly kind: "solo";
  readonly id: string;
  readonly value: number;
  readonly timestamp: number;
  readonly replayId: string | null;
  readonly mode: GameMode;
}

export interface VsScore {
  readonly kind: "vs";
  readonly id: string;
  readonly value: number;
  readonly timestamp: number;
  readonly replayId: string | null;
  readonly mode: GameMode;
  readonly vsResult: "win" | "lose" | "disconnect";
  readonly opponentName: string;
  readonly opponentScore: number;
}

export type Score = SoloScore | VsScore;

export interface ScoreHistory {
  readonly scores: Score[];
  readonly bestScore: Score | null;
}

export function createScore(
  id: string,
  value: number,
  mode: GameMode,
  replayId: string | null = null,
): SoloScore {
  return { kind: "solo", id, value, timestamp: Date.now(), replayId, mode };
}

export function createVsScore(
  id: string,
  value: number,
  mode: GameMode,
  vsResult: "win" | "lose" | "disconnect",
  opponentName: string,
  opponentScore: number,
  replayId: string | null = null,
): VsScore {
  return { kind: "vs", id, value, timestamp: Date.now(), replayId, mode, vsResult, opponentName, opponentScore };
}

export function buildHistory(scores: Score[]): ScoreHistory {
  const sorted = [...scores].sort((a, b) => b.timestamp - a.timestamp);
  const bestScore =
    sorted.length > 0
      ? sorted.reduce((best, s) => (s.value > best.value ? s : best))
      : null;
  return { scores: sorted, bestScore };
}

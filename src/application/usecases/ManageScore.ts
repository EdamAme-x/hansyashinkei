import type { GameMode } from "@domain/entities/GameMode";
import type { ScoreRepository } from "@domain/repositories/ScoreRepository";
import type { Score, ScoreHistory } from "@domain/entities/Score";
import { createScore, createVsScore, buildHistory } from "@domain/entities/Score";

export interface ScoreStats {
  totalPlays: number;
  totalScore: number;
  bestScore: number;
  avgScore: number;
}

function computeStats(scores: Score[]): ScoreStats {
  const totalPlays = scores.length;
  const totalScore = scores.reduce((sum, s) => sum + s.value, 0);
  const bestScore = scores.reduce((best, s) => Math.max(best, s.value), 0);
  const recent = scores
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);
  const avgScore = recent.length > 0
    ? Math.round(recent.reduce((sum, s) => sum + s.value, 0) / recent.length)
    : 0;
  return { totalPlays, totalScore, bestScore, avgScore };
}

export class ManageScore {
  constructor(private readonly repository: ScoreRepository) {}

  async record(
    value: number,
    mode: GameMode,
    replayId?: string | null,
    vsResult?: "win" | "lose" | "disconnect",
    opponentName?: string,
    opponentScore?: number,
  ): Promise<string> {
    const id = crypto.randomUUID();
    const score = vsResult && opponentName !== undefined && opponentScore !== undefined
      ? createVsScore(id, value, mode, vsResult, opponentName, opponentScore, replayId ?? null)
      : createScore(id, value, mode, replayId ?? null);
    await this.repository.save(score);
    return id;
  }

  async getHistory(mode?: GameMode): Promise<ScoreHistory> {
    const all = await this.repository.getAll();
    const filtered = mode
      ? all.filter((s) => s.mode === mode)
      : all;
    return buildHistory(filtered);
  }

  async getStats(mode?: GameMode): Promise<ScoreStats> {
    const all = await this.repository.getAll();
    const filtered = mode
      ? all.filter((s) => s.mode === mode)
      : all;
    return computeStats(filtered);
  }

  async clearHistory(): Promise<void> {
    await this.repository.clear();
  }
}

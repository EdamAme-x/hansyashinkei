import type { GameMode } from "@domain/entities/GameMode";
import type { ScoreRepository } from "@domain/repositories/ScoreRepository";
import type { Score, ScoreHistory } from "@domain/entities/Score";
import { createScore, buildHistory } from "@domain/entities/Score";

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
  const avgScore = totalPlays > 0 ? Math.round(totalScore / totalPlays) : 0;
  return { totalPlays, totalScore, bestScore, avgScore };
}

export class ManageScore {
  constructor(private readonly repository: ScoreRepository) {}

  async record(value: number, mode: GameMode, replayId: string | null = null): Promise<string> {
    const id = crypto.randomUUID();
    const score = createScore(id, value, mode, replayId);
    await this.repository.save(score);
    return id;
  }

  async getHistory(mode?: GameMode): Promise<ScoreHistory> {
    const all = await this.repository.getAll();
    const filtered = mode
      ? all.filter((s) => (s.mode ?? "classic") === mode)
      : all;
    return buildHistory(filtered);
  }

  async getStats(mode?: GameMode): Promise<ScoreStats> {
    const all = await this.repository.getAll();
    const filtered = mode
      ? all.filter((s) => (s.mode ?? "classic") === mode)
      : all;
    return computeStats(filtered);
  }

  async clearHistory(): Promise<void> {
    await this.repository.clear();
  }
}

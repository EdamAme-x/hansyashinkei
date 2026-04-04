import type { ScoreRepository } from "@domain/repositories/ScoreRepository";
import type { ScoreHistory } from "@domain/entities/Score";
import { createScore, buildHistory } from "@domain/entities/Score";

export class ManageScore {
  constructor(private readonly repository: ScoreRepository) {}

  async record(value: number): Promise<void> {
    const id = crypto.randomUUID();
    const score = createScore(id, value);
    await this.repository.save(score);
  }

  async getHistory(): Promise<ScoreHistory> {
    const scores = await this.repository.getAll();
    return buildHistory(scores);
  }

  async clearHistory(): Promise<void> {
    await this.repository.clear();
  }
}

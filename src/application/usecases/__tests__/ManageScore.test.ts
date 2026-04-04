import { describe, it, expect, beforeEach } from "vitest";
import { ManageScore } from "@application/usecases/ManageScore";
import type { Score } from "@domain/entities/Score";
import type { ScoreRepository } from "@domain/repositories/ScoreRepository";

class InMemoryScoreRepository implements ScoreRepository {
  private scores: Score[] = [];

  async save(score: Score): Promise<void> {
    this.scores.push(score);
  }

  async getAll(): Promise<Score[]> {
    return [...this.scores];
  }

  async clear(): Promise<void> {
    this.scores = [];
  }
}

describe("ManageScore", () => {
  let usecase: ManageScore;

  beforeEach(() => {
    usecase = new ManageScore(new InMemoryScoreRepository());
  });

  it("should record a score and retrieve history", async () => {
    await usecase.record(100);
    await usecase.record(250);

    const history = await usecase.getHistory();
    expect(history.scores).toHaveLength(2);
    expect(history.bestScore?.value).toBe(250);
  });

  it("should clear history", async () => {
    await usecase.record(100);
    await usecase.clearHistory();

    const history = await usecase.getHistory();
    expect(history.scores).toHaveLength(0);
    expect(history.bestScore).toBeNull();
  });
});

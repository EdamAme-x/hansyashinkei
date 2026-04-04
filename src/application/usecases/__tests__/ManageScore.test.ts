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
    await usecase.record(100, "classic");
    await usecase.record(250, "classic");

    const history = await usecase.getHistory();
    expect(history.scores).toHaveLength(2);
    expect(history.bestScore?.value).toBe(250);
  });

  it("should filter history by mode", async () => {
    await usecase.record(100, "classic");
    await usecase.record(200, "triple");
    await usecase.record(150, "classic");

    const classic = await usecase.getHistory("classic");
    expect(classic.scores).toHaveLength(2);
    expect(classic.bestScore?.value).toBe(150);

    const triple = await usecase.getHistory("triple");
    expect(triple.scores).toHaveLength(1);
    expect(triple.bestScore?.value).toBe(200);
  });

  it("should return stats by mode", async () => {
    await usecase.record(100, "classic");
    await usecase.record(200, "triple");

    const stats = await usecase.getStats("classic");
    expect(stats.totalPlays).toBe(1);
    expect(stats.bestScore).toBe(100);
  });

  it("should clear history", async () => {
    await usecase.record(100, "classic");
    await usecase.clearHistory();

    const history = await usecase.getHistory();
    expect(history.scores).toHaveLength(0);
    expect(history.bestScore).toBeNull();
  });
});

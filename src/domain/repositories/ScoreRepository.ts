import type { Score } from "@domain/entities/Score";

export interface ScoreRepository {
  save(score: Score): Promise<void>;
  getAll(): Promise<Score[]>;
  clear(): Promise<void>;
}

import type { GameMode } from "@domain/entities/GameMode";

export interface BestScoreRecord {
  readonly score: number;
  readonly replayId: string | null;
}

export interface BestScoreRepository {
  load(mode: GameMode): Promise<BestScoreRecord | null>;
  save(mode: GameMode, record: BestScoreRecord): Promise<void>;
}

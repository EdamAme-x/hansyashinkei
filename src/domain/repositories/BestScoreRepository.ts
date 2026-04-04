export interface BestScoreRecord {
  readonly score: number;
  readonly replayId: string | null;
}

export interface BestScoreRepository {
  load(): Promise<BestScoreRecord | null>;
  save(record: BestScoreRecord): Promise<void>;
}

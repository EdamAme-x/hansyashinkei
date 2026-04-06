export interface SignPayload {
  achievementId: string;
  unlockedAt: number;
  scoreId: string | null;
  replayId: string | null;
  conditionType: string;
  satisfiedValue: number;
}

export interface AchievementSigner {
  sign(payload: SignPayload): Promise<string>;
  verify(payload: SignPayload, signature: string): Promise<boolean>;
}

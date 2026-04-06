import type { Score } from "@domain/entities/Score";
import type { AchievementRecord, UnlockProof, AchievementDef } from "@domain/entities/Achievement";
import type { AchievementRepository } from "@domain/repositories/AchievementRepository";
import type { ScoreRepository } from "@domain/repositories/ScoreRepository";
import type { ReplayRepository } from "@domain/repositories/ReplayRepository";
import type { AchievementSigner, SignPayload } from "@infrastructure/crypto/AchievementSigner";
import { evaluateAchievements, type EvalContext } from "@domain/entities/AchievementEvaluator";
import { ACHIEVEMENT_DEFS, getAchievementDef } from "@domain/entities/AchievementDefs";
import { DEFAULT_SKIN_ID } from "@domain/entities/SkinDefs";

export interface UnlockEvent {
  readonly achievementId: string;
  readonly skinId: string;
  readonly label: string;
  readonly description: string;
}

export class ManageAchievement {
  constructor(
    private readonly repo: AchievementRepository,
    private readonly signer: AchievementSigner,
    private readonly scoreRepo: ScoreRepository,
    private readonly replayRepo: ReplayRepository,
  ) {}

  /** Called after game over. Returns newly unlocked achievements. */
  async evaluateAndUnlock(newScore: Score, maxKeysPerSecond = 0, vsPlayed = false): Promise<UnlockEvent[]> {
    const allScores = await this.scoreRepo.getAll();
    const existing = await this.repo.getAll();
    const alreadyUnlocked = new Set(existing.map((r) => r.id));

    const ctx: EvalContext = { scores: allScores, newScore, alreadyUnlocked, maxKeysPerSecond, vsPlayed };
    const results = evaluateAchievements(ACHIEVEMENT_DEFS, ctx);
    const events: UnlockEvent[] = [];

    for (const result of results) {
      const def = getAchievementDef(result.defId);
      if (!def) continue;

      const unlockedAt = Date.now();
      const payload: SignPayload = {
        achievementId: def.id,
        unlockedAt,
        scoreId: result.scoreId,
        replayId: result.replayId,
        conditionType: result.snapshot.type,
        satisfiedValue: result.snapshot.satisfiedValue,
      };
      const signature = await this.signer.sign(payload);

      const proof: UnlockProof = {
        achievementId: def.id,
        unlockedAt,
        scoreId: result.scoreId,
        replayId: result.replayId,
        conditionSnapshot: result.snapshot,
        signature,
      };

      const record: AchievementRecord = { id: def.id, proof, verified: true };
      await this.repo.save(record);

      events.push({
        achievementId: def.id,
        skinId: def.rewardSkinId,
        label: def.label,
        description: def.description,
      });
    }

    return events;
  }

  /** Verify all proofs on startup. Marks tampered records as unverified. */
  async verifyAllOnLoad(): Promise<void> {
    const records = await this.repo.getAll();

    for (const record of records) {
      const { proof } = record;
      let verified = true;

      // 1. HMAC signature check
      const signatureValid = await this.signer.verify(
        {
          achievementId: proof.achievementId,
          unlockedAt: proof.unlockedAt,
          scoreId: proof.scoreId,
          replayId: proof.replayId,
          conditionType: proof.conditionSnapshot.type,
          satisfiedValue: proof.conditionSnapshot.satisfiedValue,
        },
        proof.signature,
      );
      if (!signatureValid) verified = false;

      // 2. Score existence check (for score-based achievements)
      if (verified && proof.scoreId) {
        const allScores = await this.scoreRepo.getAll();
        if (!allScores.some((s) => s.id === proof.scoreId)) {
          verified = false;
        }
      }

      // 3. Replay score cross-check (replay may be pruned, so missing = ok)
      if (verified && proof.replayId) {
        const replay = await this.replayRepo.getById(proof.replayId);
        if (replay) {
          const def = getAchievementDef(proof.achievementId);
          if (def && isScoreCondition(def)) {
            const threshold = (def.condition as { threshold: number }).threshold;
            if (replay.finalScore < threshold) verified = false;
          }
        }
      }

      if (verified !== record.verified) {
        await this.repo.save({ ...record, verified });
      }
    }
  }

  async getUnlockedIds(): Promise<Set<string>> {
    const records = await this.repo.getAll();
    return new Set(records.filter((r) => r.verified).map((r) => r.id));
  }

  async getActiveSkinId(): Promise<string> {
    const setting = await this.repo.loadActiveSkin();
    return setting?.skinId ?? DEFAULT_SKIN_ID;
  }

  async setActiveSkin(skinId: string): Promise<void> {
    await this.repo.saveActiveSkin({ id: "active-skin", skinId });
  }

  async getAllRecords(): Promise<AchievementRecord[]> {
    return this.repo.getAll();
  }

  /** For export: serialized achievement records. */
  async exportRecords(): Promise<AchievementRecord[]> {
    return this.repo.getAll();
  }

  /** Re-sign imported achievements with the current device's HMAC key. */
  async importAndResign(records: AchievementRecord[]): Promise<void> {
    for (const record of records) {
      const { proof } = record;
      const payload: SignPayload = {
        achievementId: proof.achievementId,
        unlockedAt: proof.unlockedAt,
        scoreId: proof.scoreId,
        replayId: proof.replayId,
        conditionType: proof.conditionSnapshot.type,
        satisfiedValue: proof.conditionSnapshot.satisfiedValue,
      };
      const signature = await this.signer.sign(payload);

      const resignedProof: UnlockProof = { ...proof, signature };
      await this.repo.save({ ...record, proof: resignedProof, verified: true });
    }
  }
}

function isScoreCondition(def: AchievementDef): boolean {
  return (
    def.condition.type === "score_classic" ||
    def.condition.type === "score_triple" ||
    def.condition.type === "score_any_mode"
  );
}

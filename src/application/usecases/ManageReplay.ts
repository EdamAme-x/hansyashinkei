import type { Replay } from "@domain/entities/Replay";
import type { ReplayRepository } from "@domain/repositories/ReplayRepository";

export class ManageReplay {
  constructor(
    private readonly repository: ReplayRepository,
    private readonly maxReplays: number = 20,
  ) {}

  async save(replay: Replay): Promise<void> {
    await this.repository.save(replay);
  }

  async getById(id: string): Promise<Replay | null> {
    return this.repository.getById(id);
  }

  async getAll(): Promise<Replay[]> {
    return this.repository.getAll();
  }

  async prune(bestReplayId: string | null): Promise<void> {
    const all = await this.repository.getAll();
    if (all.length <= this.maxReplays) return;

    const sorted = [...all].sort((a, b) => a.timestamp - b.timestamp);
    const excess = sorted.length - this.maxReplays;
    const toDelete: string[] = [];

    for (const replay of sorted) {
      if (toDelete.length >= excess) break;
      if (replay.id !== bestReplayId) {
        toDelete.push(replay.id);
      }
    }

    if (toDelete.length > 0) {
      await this.repository.deleteMany(toDelete);
    }
  }
}

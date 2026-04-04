import type { Replay } from "@domain/entities/Replay";
import type { ReplayRepository } from "@domain/repositories/ReplayRepository";
import type { ReplaySerializer } from "@domain/repositories/ReplaySerializer";

export type { ReplaySerializer };

export class ManageReplay {
  constructor(
    private readonly repository: ReplayRepository,
    private readonly serializer: ReplaySerializer,
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

    // If best replay was in the oldest batch, we may not have deleted enough
    if (toDelete.length < excess) {
      for (const replay of sorted) {
        if (toDelete.length >= excess) break;
        if (replay.id !== bestReplayId && !toDelete.includes(replay.id)) {
          toDelete.push(replay.id);
        }
      }
    }

    if (toDelete.length > 0) {
      await this.repository.deleteMany(toDelete);
    }
  }

  exportReplay(replay: Replay): Uint8Array {
    return this.serializer.encode(replay);
  }

  importReplay(data: Uint8Array): Replay | null {
    return this.serializer.decode(data);
  }
}

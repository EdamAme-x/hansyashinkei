import { describe, it, expect, beforeEach } from "vitest";
import { ManageReplay } from "@application/usecases/ManageReplay";
import type { Replay } from "@domain/entities/Replay";
import type { ReplayRepository } from "@domain/repositories/ReplayRepository";
import { createDefaultConfig } from "@domain/entities/GameConfig";

class InMemoryReplayRepository implements ReplayRepository {
  private replays = new Map<string, Replay>();

  async save(replay: Replay): Promise<void> {
    this.replays.set(replay.id, replay);
  }
  async getById(id: string): Promise<Replay | null> {
    return this.replays.get(id) ?? null;
  }
  async getAll(): Promise<Replay[]> {
    return [...this.replays.values()];
  }
  async deleteById(id: string): Promise<void> {
    this.replays.delete(id);
  }
  async deleteMany(ids: string[]): Promise<void> {
    for (const id of ids) this.replays.delete(id);
  }
}

function makeReplay(id: string, timestamp: number): Replay {
  return {
    version: 1,
    id,
    scoreId: `score-${id}`,
    seed: 42,
    config: createDefaultConfig(),
    finalScore: 10,
    timestamp,
    dts: [],
    events: [],
  };
}

describe("ManageReplay", () => {
  let usecase: ManageReplay;
  let repo: InMemoryReplayRepository;

  beforeEach(() => {
    repo = new InMemoryReplayRepository();
    usecase = new ManageReplay(repo, 3);
  });

  it("should save and retrieve a replay", async () => {
    const r = makeReplay("r1", 1000);
    await usecase.save(r);
    const found = await usecase.getById("r1");
    expect(found?.id).toBe("r1");
  });

  it("should prune oldest replays when over limit", async () => {
    await usecase.save(makeReplay("r1", 1000));
    await usecase.save(makeReplay("r2", 2000));
    await usecase.save(makeReplay("r3", 3000));
    await usecase.save(makeReplay("r4", 4000));

    await usecase.prune(null);

    const all = await usecase.getAll();
    expect(all).toHaveLength(3);
    expect(all.map((r) => r.id).sort()).toEqual(["r2", "r3", "r4"]);
  });

  it("should protect best replay from pruning", async () => {
    await usecase.save(makeReplay("r1", 1000)); // oldest, but best
    await usecase.save(makeReplay("r2", 2000));
    await usecase.save(makeReplay("r3", 3000));
    await usecase.save(makeReplay("r4", 4000));

    await usecase.prune("r1");

    const all = await usecase.getAll();
    expect(all).toHaveLength(3);
    expect(all.find((r) => r.id === "r1")).toBeDefined();
  });

  it("should not prune when under limit", async () => {
    await usecase.save(makeReplay("r1", 1000));
    await usecase.save(makeReplay("r2", 2000));

    await usecase.prune(null);

    const all = await usecase.getAll();
    expect(all).toHaveLength(2);
  });
});

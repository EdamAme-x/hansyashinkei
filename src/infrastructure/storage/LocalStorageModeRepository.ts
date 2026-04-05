import type { GameMode } from "@domain/entities/GameMode";
import type { ModeRepository } from "@domain/repositories/ModeRepository";
import type { KVStore } from "@domain/repositories/KVStore";

const KEY = "hs-mode";

export class LocalStorageModeRepository implements ModeRepository {
  constructor(private readonly kv: KVStore) {}

  load(): GameMode {
    const v = this.kv.get(KEY);
    return v === "triple" ? "triple" : "classic";
  }

  save(mode: GameMode): void {
    this.kv.set(KEY, mode);
  }
}

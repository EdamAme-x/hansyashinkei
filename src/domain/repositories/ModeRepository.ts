import type { GameMode } from "@domain/entities/GameMode";

export interface ModeRepository {
  load(): GameMode;
  save(mode: GameMode): void;
}

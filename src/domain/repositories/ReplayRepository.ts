import type { Replay } from "@domain/entities/Replay";

export interface ReplayRepository {
  save(replay: Replay): Promise<void>;
  getById(id: string): Promise<Replay | null>;
  getAll(): Promise<Replay[]>;
  deleteById(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
}

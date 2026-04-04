import type { Replay } from "@domain/entities/Replay";
import type { ReplayRepository } from "@domain/repositories/ReplayRepository";
import type { DeviceKeyStore } from "@infrastructure/crypto/DeviceKeyStore";
import { EncryptedStore } from "./EncryptedStore";

export class IndexedDbReplayRepository implements ReplayRepository {
  private readonly store: EncryptedStore;

  constructor(crypto: DeviceKeyStore) {
    this.store = new EncryptedStore("replays", crypto, true);
  }

  async save(replay: Replay): Promise<void> {
    await this.store.put(replay);
  }

  async getById(id: string): Promise<Replay | null> {
    return this.store.get<Replay>(id);
  }

  async getAll(): Promise<Replay[]> {
    return this.store.getAll<Replay>();
  }

  async deleteById(id: string): Promise<void> {
    await this.store.del(id);
  }

  async deleteMany(ids: string[]): Promise<void> {
    await this.store.delMany(ids);
  }
}

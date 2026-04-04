import type { Replay } from "@domain/entities/Replay";

export interface ReplaySerializer {
  encode(replay: Replay): Uint8Array;
  decode(data: Uint8Array): Replay | null;
}

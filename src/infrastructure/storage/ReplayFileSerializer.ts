import { encode, decode } from "cbor-x";
import { deflate, inflate } from "pako";
import type { Replay } from "@domain/entities/Replay";
import type { ReplaySerializer } from "@domain/repositories/ReplaySerializer";

export class ReplayFileSerializer implements ReplaySerializer {
  encode(replay: Replay): Uint8Array {
    const cbor = encode(replay);
    return deflate(new Uint8Array(cbor.buffer, cbor.byteOffset, cbor.byteLength));
  }

  decode(data: Uint8Array): Replay | null {
    try {
      const decompressed = inflate(data);
      const replay = decode(decompressed) as Record<string, unknown>;

      if (
        replay == null ||
        typeof replay !== "object" ||
        typeof replay.version !== "number" ||
        typeof replay.seed !== "number" ||
        !Array.isArray(replay.dts) ||
        !replay.config
      ) {
        return null;
      }

      return (replay as unknown) as Replay;
    } catch {
      return null;
    }
  }
}

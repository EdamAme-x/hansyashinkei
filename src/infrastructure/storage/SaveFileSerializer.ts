import { encode, decode } from "cbor-x";
import { deflate, inflate } from "pako";
import type { SaveData } from "@domain/entities/SaveData";
import { isSaveData } from "@domain/entities/SaveData";
import type { SaveSerializer } from "@domain/repositories/SaveSerializer";

export class SaveFileSerializer implements SaveSerializer {
  encode(data: SaveData): Uint8Array {
    const cbor = encode(data);
    return deflate(new Uint8Array(cbor.buffer, cbor.byteOffset, cbor.byteLength));
  }

  decode(raw: Uint8Array): SaveData | null {
    try {
      const decompressed = inflate(raw);
      const obj = decode(decompressed);
      if (!isSaveData(obj)) return null;
      return obj as SaveData;
    } catch {
      return null;
    }
  }
}

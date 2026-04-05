import type { SaveData } from "@domain/entities/SaveData";

export interface SaveSerializer {
  encode(data: SaveData): Uint8Array;
  decode(raw: Uint8Array): SaveData | null;
}

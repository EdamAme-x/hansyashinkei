import type { KVStore } from "@domain/repositories/KVStore";

const KEY = "hs-username";

export function loadUsername(kv: KVStore): string | null {
  return kv.get(KEY) || null;
}

export function saveUsername(kv: KVStore, name: string): void {
  kv.set(KEY, name.trim());
}

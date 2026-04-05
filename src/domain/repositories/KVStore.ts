/** Simple key-value store abstraction over encrypted localStorage. */
export interface KVStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

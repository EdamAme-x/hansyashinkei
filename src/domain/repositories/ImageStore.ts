export interface IImageStore {
  save(key: string, file: File): Promise<string>;
  load(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
}

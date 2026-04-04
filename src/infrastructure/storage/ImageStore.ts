import { openGameDb } from "./gameDb";
import type { IImageStore } from "@domain/repositories/ImageStore";

const STORE_NAME = "images";
const MAX_SIZE = 1024;

/** Resize and compress image to avoid blurry/pixelated textures. */
async function optimizeImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);

  let w = bitmap.width;
  let h = bitmap.height;

  // Scale down if larger than MAX_SIZE while keeping aspect ratio
  if (w > MAX_SIZE || h > MAX_SIZE) {
    const scale = MAX_SIZE / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Use high quality scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.85 });
  const reader = new FileReader();
  return new Promise((resolve) => {
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export class ImageStore implements IImageStore {
  async save(key: string, file: File): Promise<string> {
    const dataUrl = file.type.startsWith("image/")
      ? await optimizeImage(file)
      : await fileToDataUrl(file);
    const db = await openGameDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ id: key, data: dataUrl });
      tx.oncomplete = () => resolve(dataUrl);
      tx.onerror = () => reject(tx.error);
    });
  }

  async load(key: string): Promise<string | null> {
    const db = await openGameDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result?.data ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async remove(key: string): Promise<void> {
    const db = await openGameDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

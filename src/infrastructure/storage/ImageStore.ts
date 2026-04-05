import { openGameDb } from "./gameDb";
import type { IImageStore } from "@domain/repositories/ImageStore";

const STORE_NAME = "images";
const MAX_SIZE = 1024;

/** Resize image to max dimension, return as data URL. */
function optimizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let w = img.width;
      let h = img.height;

      if (w > MAX_SIZE || h > MAX_SIZE) {
        const scale = MAX_SIZE / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);

      resolve(canvas.toDataURL("image/webp", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    img.src = objectUrl;
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

const DB_NAME = "hansyashinkei";
const DB_VERSION = 2;

let dbInstance: IDBDatabase | null = null;

export function openGameDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

      if (oldVersion < 1) {
        db.createObjectStore("scores", { keyPath: "id" });
      }
      if (oldVersion < 2) {
        db.createObjectStore("replays", { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

const DB_NAME = "hs";
const DB_VERSION = 5;

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
      if (oldVersion < 3) {
        db.createObjectStore("meta", { keyPath: "id" });
      }
      if (oldVersion < 4) {
        db.createObjectStore("images", { keyPath: "id" });
      }
      if (oldVersion < 5) {
        db.createObjectStore("achievements", { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      // If another tab upgrades the DB, close our connection so the upgrade
      // can proceed and re-open fresh on the next access.
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

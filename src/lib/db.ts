const DB_NAME = 'academic-os';
const DB_VERSION = 2;

export const STORES = ['courses', 'assignments', 'lectures', 'exams', 'notes', 'sessions', 'flashcards', 'annotations'] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export function dbGetAll<T>(store: StoreName): Promise<T[]> {
  return tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>).catch(() => []);
}

export function dbPut(store: StoreName, value: unknown): Promise<unknown> {
  return tx(store, 'readwrite', (s) => s.put(value));
}

export function dbDelete(store: StoreName, id: string): Promise<unknown> {
  return tx(store, 'readwrite', (s) => s.delete(id));
}

export function dbClear(store: StoreName): Promise<unknown> {
  return tx(store, 'readwrite', (s) => s.clear());
}

export async function dbBulkPut(store: StoreName, values: unknown[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const s = t.objectStore(store);
    values.forEach((v) => s.put(v));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

import type { LogRecord, LogTransport, TransportResult } from '@mdreview/core/logging';

const DEFAULT_DB_NAME = 'mdview-logs';
const DB_VERSION = 1;
const STORE = 'records';
const INDEX_BY_DATE = 'by_date';

interface StoredRecord {
  _date: string;
  record: LogRecord;
}

/**
 * Persistent IndexedDB-backed fallback for the Chrome extension log pipeline.
 *
 * Records are bucketed by UTC date stem so the composite transport can drain
 * them in chronological order when the primary (native host) recovers.
 */
export class IndexedDBTransport implements LogTransport {
  private readonly dbName: string;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(opts?: { dbName?: string }) {
    this.dbName = opts?.dbName ?? DEFAULT_DB_NAME;
  }

  async export(records: readonly LogRecord[]): Promise<TransportResult> {
    if (records.length === 0) return { ok: true };
    try {
      const db = await this.getDb();
      await runTransaction(db, 'readwrite', (store) => {
        for (const record of records) {
          const value: StoredRecord = { _date: dateStem(record.timestamp), record };
          store.add(value);
        }
      });
      return { ok: true };
    } catch (err) {
      // Reset cached connection so a future call can retry from scratch.
      this.dbPromise = null;
      return { ok: false, reason: errorReason(err) };
    }
  }

  async listBuckets(): Promise<string[]> {
    const db = await this.getDb();
    const dates = new Set<string>();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const index = store.index(INDEX_BY_DATE);
      const req = index.openKeyCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          dates.add(String(cursor.key));
          cursor.continue();
        }
      };
      req.onerror = () => reject(req.error ?? new Error('cursor failed'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
    });
    return [...dates].sort();
  }

  async getBucket(date: string): Promise<LogRecord[]> {
    const db = await this.getDb();
    const out: LogRecord[] = [];
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const index = store.index(INDEX_BY_DATE);
      const req = index.openCursor(IDBKeyRange.only(date));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          const value = cursor.value as StoredRecord;
          out.push(value.record);
          cursor.continue();
        }
      };
      req.onerror = () => reject(req.error ?? new Error('cursor failed'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
    });
    return out;
  }

  async deleteBucket(date: string): Promise<void> {
    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const index = store.index(INDEX_BY_DATE);
      const req = index.openCursor(IDBKeyRange.only(date));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      req.onerror = () => reject(req.error ?? new Error('cursor failed'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
    });
  }

  async shutdown(): Promise<void> {
    if (!this.dbPromise) return;
    try {
      const db = await this.dbPromise;
      db.close();
    } catch {
      /* best-effort */
    }
    this.dbPromise = null;
  }

  private getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDb(this.dbName).catch((err) => {
        this.dbPromise = null;
        throw err;
      });
    }
    return this.dbPromise;
  }
}

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const idb = (globalThis as unknown as { indexedDB: IDBFactory | undefined }).indexedDB;
    if (!idb) {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const req = idb.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { autoIncrement: true });
        store.createIndex(INDEX_BY_DATE, '_date', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('open failed'));
    req.onblocked = () => reject(new Error('open blocked'));
  });
}

function runTransaction(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, mode);
    } catch (err) {
      reject(err);
      return;
    }
    const store = tx.objectStore(STORE);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
    try {
      work(store);
    } catch (err) {
      try {
        tx.abort();
      } catch {
        /* ignore */
      }
      reject(err);
    }
  });
}

/** Convert a nanosecond timestamp to a YYYY-MM-DD UTC date stem. */
function dateStem(timestampNs: number): string {
  const ms = Math.floor(timestampNs / 1_000_000);
  return new Date(ms).toISOString().slice(0, 10);
}

function errorReason(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'unknown error';
  }
}

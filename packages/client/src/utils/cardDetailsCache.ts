import { CardDetails } from '@utils/datatypes/Card';

// Persistent client-side cache for card details keyed by scryfall_id.
//
// Lookup goes IndexedDB → server in one shot. Concurrent callers within the
// same tick are coalesced into a single POST to /cube/api/getdetailsforcards,
// so a page with 50 components each asking for one card produces one round
// trip instead of 50.
//
// Each entry carries a `cachedAt` timestamp and expires after a week. Reads
// past TTL are treated as misses; the server refetch overwrites the entry on
// the way back through. Entries from before this scheme (no `cachedAt`) are
// likewise treated as expired so existing users get a one-time refresh.
//
// Two kinds of response must not live for the full week:
//   - Placeholders (`error: true`). The server returns one when the id isn't in
//     its catalog — a card newer than that instance's data, a transient lookup
//     failure. These are never persisted, and any already stored are ignored.
//   - Volatile cards: non-English printings and anything released recently or
//     not yet released. During spoiler season Scryfall often has a foreign-
//     language version of a card first and fixes it up in place later, so the
//     data behind the same id keeps changing. These entries are stamped with the
//     server's card data version and dropped as soon as the page reports a
//     different one, with a one-day TTL as a backstop when no version is known.

const DB_NAME = 'cubecobra-card-details';
const DB_VERSION = 1;
const STORE = 'details';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VOLATILE_TTL_MS = 24 * 60 * 60 * 1000;
const VOLATILE_RELEASE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

interface CachedEntry {
  details: CardDetails;
  cachedAt: number;
  // Server card data version the details were fetched under (empty in local dev).
  version?: string;
}

// The card data version the server that rendered this page had loaded.
const currentCatalogVersion = (): string => (typeof window !== 'undefined' && window.reactProps?.cardDbVersion) || '';

const isVolatile = (details: CardDetails, now: number): boolean => {
  if (details.language && details.language !== 'en') return true;
  const released = Date.parse(details.released_at);
  return Number.isNaN(released) || now - released < VOLATILE_RELEASE_WINDOW_MS;
};

const isUsable = (entry: CachedEntry | undefined, now: number): entry is CachedEntry => {
  if (!entry || typeof entry.cachedAt !== 'number' || !entry.details) return false;
  if (entry.details.error) return false;
  const age = now - entry.cachedAt;
  if (age > TTL_MS) return false;
  if (isVolatile(entry.details, now)) {
    if (age > VOLATILE_TTL_MS) return false;
    const current = currentCatalogVersion();
    if (current && entry.version !== current) return false;
  }
  return true;
};

const hasIndexedDB = typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

let dbPromise: Promise<IDBDatabase> | null = null;
const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
};

const wrap = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const readMany = async (ids: string[]): Promise<Record<string, CardDetails | undefined>> => {
  const result: Record<string, CardDetails | undefined> = {};
  if (!hasIndexedDB) return result;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const now = Date.now();
    await Promise.all(
      ids.map(async (id) => {
        const entry = (await wrap(store.get(id))) as CachedEntry | undefined;
        if (isUsable(entry, now)) result[id] = entry.details;
      }),
    );
  } catch {
    // fall through with empty result; caller fetches everything from the server
  }
  return result;
};

const writeMany = async (entries: Array<[string, CardDetails]>, version: string): Promise<void> => {
  if (!hasIndexedDB || entries.length === 0) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const cachedAt = Date.now();
    for (const [id, value] of entries) {
      const entry: CachedEntry = { details: value, cachedAt, version };
      store.put(entry, id);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // best-effort persistence; the in-memory result still resolves
  }
};

interface PendingRequest {
  id: string;
  resolve: (value: CardDetails | null) => void;
}

let pendingQueue: PendingRequest[] = [];
let pendingFlush: Promise<void> | null = null;

const flushPending = async (): Promise<void> => {
  const batch = pendingQueue;
  pendingQueue = [];
  pendingFlush = null;

  const uniqueIds = [...new Set(batch.map((r) => r.id))];
  const detailsById: Record<string, CardDetails | null> = {};
  let version = '';

  try {
    const response = await fetch('/cube/api/getdetailsforcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: uniqueIds }),
    });
    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true' && Array.isArray(json.details)) {
        version = typeof json.version === 'string' ? json.version : '';
        for (let i = 0; i < uniqueIds.length; i++) {
          detailsById[uniqueIds[i]] = json.details[i] ?? null;
        }
      }
    }
  } catch {
    // network error — every pending caller resolves to null below
  }

  const toPersist: Array<[string, CardDetails]> = [];
  for (const id of uniqueIds) {
    const value = detailsById[id];
    // Placeholders still go back to callers, but never into the cache — the card
    // may well exist on the next request (see header).
    if (value && !value.error) toPersist.push([id, value]);
  }
  if (toPersist.length > 0) {
    // Fire and forget — persistence shouldn't delay the response to consumers.
    writeMany(toPersist, version);
  }

  for (const request of batch) {
    request.resolve(detailsById[request.id] ?? null);
  }
};

const fetchFromServer = (id: string): Promise<CardDetails | null> =>
  new Promise<CardDetails | null>((resolve) => {
    pendingQueue.push({ id, resolve });
    if (!pendingFlush) {
      // Coalesce all calls scheduled in the same microtask into one POST.
      pendingFlush = Promise.resolve().then(flushPending);
    }
  });

export const getCardDetails = async (ids: string[]): Promise<Record<string, CardDetails | null>> => {
  if (ids.length === 0) return {};
  const uniqueIds = [...new Set(ids)];

  const cached = await readMany(uniqueIds);

  const result: Record<string, CardDetails | null> = {};
  const missing: string[] = [];
  for (const id of uniqueIds) {
    if (cached[id] !== undefined) {
      result[id] = cached[id]!;
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    const fetched = await Promise.all(missing.map((id) => fetchFromServer(id)));
    for (let i = 0; i < missing.length; i++) {
      result[missing[i]] = fetched[i];
    }
  }

  return result;
};

export const getCardDetail = async (id: string): Promise<CardDetails | null> => {
  const result = await getCardDetails([id]);
  return result[id] ?? null;
};

// Exposed for tests / debugging. Not used by app code.
export const clearCardDetailsCache = async (): Promise<void> => {
  if (!hasIndexedDB) return;
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

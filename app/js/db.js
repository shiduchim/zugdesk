// Tiny IndexedDB wrapper. Only store.js should import this.
export const DB_NAME = 'zugdesk';
export const DB_VERSION = 1;

// Every record lives in one of these object stores, keyed by `id`.
// Keep this list in sync with spec/build-handoff.md section C.
export const STORES = {
  contacts:        { indexes: ['city', 'updatedAt', 'pinned', 'folderId'] },   // Contact (+ roles, groups, pin, folder)
  people:          { indexes: ['updatedAt'] },                                  // Person (suggested people / ideas)
  notes:           { indexes: ['updatedAt', 'contactIds*', 'personIds*'] },     // Note (one record, many links)
  events:          { indexes: ['at', 'contactIds*', 'personIds*'] },            // ConversationEvent
  followUps:       { indexes: ['dueAt', 'contactId', 'personId', 'done'] },     // FollowUp
  folders:         { indexes: ['name'] },                                       // Folder (contacts)
  sources:         { indexes: ['personId'] },                                   // SuggestionSource
  interests:       { indexes: ['personId'] },                                   // PreliminaryInterest
  offers:          { indexes: ['personId', 'status'] },                         // FormalOffer
  tries:           { indexes: ['offerId', 'personId'] },                        // ShidduchTry
  stageEvents:     { indexes: ['tryId', 'at'] },                                // StageEvent
  dateEvents:      { indexes: ['tryId', 'at'] },                                // DateEvent
  profile:         { indexes: [] },                                             // UserProfile (single record id "me")
  profileVersions: { indexes: ['createdAt'] },                                  // ProfileVersion (short versions)
  shares:          { indexes: ['createdAt'] },                                  // ShareSnapshot
  attachments:     { indexes: ['personId', 'contactId'] },                      // Attachment
  meta:            { indexes: [] },                                             // schema version, seed state
};

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => upgrade(req.result, e.oldVersion);
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => console.warn('IndexedDB open blocked — close other ZugDesk tabs');
  });
  return dbPromise;
}

// Migration strategy: each schema version adds its changes in order.
// Never delete a store with user data; add new stores/indexes only.
function upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    for (const [name, def] of Object.entries(STORES)) {
      const os = db.createObjectStore(name, { keyPath: 'id' });
      for (const idx of def.indexes) {
        const multi = idx.endsWith('*');
        const key = multi ? idx.slice(0, -1) : idx;
        os.createIndex(key, key, { multiEntry: multi });
      }
    }
  }
  // if (oldVersion < 2) { ... next migration goes here ... }
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function tx(storeNames, mode, fn) {
  const db = await openDB();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  const t = db.transaction(names, mode);
  const stores = Object.fromEntries(names.map(n => [n, t.objectStore(n)]));
  const result = await fn(stores, t);
  await new Promise((resolve, reject) => {
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('transaction aborted'));
  });
  return result;
}

export const idb = {
  get: (store, id) => tx(store, 'readonly', s => reqToPromise(s[store].get(id))),
  getAll: (store) => tx(store, 'readonly', s => reqToPromise(s[store].getAll())),
  count: (store) => tx(store, 'readonly', s => reqToPromise(s[store].count())),
  put: (store, value) => tx(store, 'readwrite', s => reqToPromise(s[store].put(value))),
  putMany: (store, values) => tx(store, 'readwrite', s => { values.forEach(v => s[store].put(v)); return values.length; }),
  delete: (store, id) => tx(store, 'readwrite', s => reqToPromise(s[store].delete(id))),
  deleteMany: (store, ids) => tx(store, 'readwrite', s => { ids.forEach(id => s[store].delete(id)); return ids.length; }),
  clear: (store) => tx(store, 'readwrite', s => reqToPromise(s[store].clear())),
  byIndex: (store, index, value) => tx(store, 'readonly', s => reqToPromise(s[store].index(index).getAll(value))),
};

export async function deleteDatabase() {
  const db = await openDB().catch(() => null);
  if (db) db.close();
  dbPromise = null;
  await reqToPromise(indexedDB.deleteDatabase(DB_NAME));
}

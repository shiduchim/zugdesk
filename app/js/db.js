// Tiny IndexedDB wrapper. Only store.js should import this.
// There are two databases, one per mode (js/mode.js), so the two modes never mix their records:
//   zugdesk           Single Mode (unchanged since Stage 6)
//   zugdesk-shadchan  Shadchan Mode
export const DB_NAME = 'zugdesk';
export const DB_VERSION = 2;
export const SH_DB_NAME = 'zugdesk-shadchan';
export const SH_DB_VERSION = 1;

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
  activity:        { indexes: ['at'] },                                         // History lines for changes that have no record of their own (v2)
  meta:            { indexes: [] },                                             // schema version, seed state
};

// Shadchan Mode keeps the same record types, so the shared pages work on either database.
// Differences: a shidduch (`offers`) is a guy and a girl, and people are looked up by kind.
// See spec/shadchan/build-notes.md for the record shapes.
// Every store also gets two small indexes for Recently deleted (only marked records are in them,
// so finding deleted things never reads the whole store):
//   deletedAt   set while a record waits in Recently deleted
//   unlinkedIn  ids of the deletions that took a link off this record (Restore puts it back)
const SH_EXTRA = { people: ['kind'], offers: ['guyId', 'girlId'] };
export const SH_STORES = Object.fromEntries(Object.entries(STORES).map(([name, def]) =>
  [name, { indexes: name === 'meta' ? [] : [...def.indexes, ...(SH_EXTRA[name] || []), 'deletedAt', 'unlinkedIn*'] }]));

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Migration strategy: each schema version adds its changes in order.
// Never delete a store with user data; add new stores/indexes only.
// Creating only what is missing covers a new database and every later addition.
function createMissing(db, upgradeTx, stores) {
  for (const [name, def] of Object.entries(stores)) {
    const os = db.objectStoreNames.contains(name) ? upgradeTx.objectStore(name) : db.createObjectStore(name, { keyPath: 'id' });
    for (const idx of def.indexes) {
      const multi = idx.endsWith('*');
      const key = multi ? idx.slice(0, -1) : idx;
      if (!os.indexNames.contains(key)) os.createIndex(key, key, { multiEntry: multi });
    }
  }
}

function makeDB(name, version, stores) {
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(name, version);
      req.onupgradeneeded = () => createMissing(req.result, req.transaction, stores);
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
      req.onblocked = () => console.warn('IndexedDB open blocked — close other ZugDesk tabs');
    });
    return dbPromise;
  }

  async function tx(storeNames, mode, fn) {
    const db = await openDB();
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const t = db.transaction(names, mode);
    const s = Object.fromEntries(names.map(n => [n, t.objectStore(n)]));
    const result = await fn(s, t);
    await new Promise((resolve, reject) => {
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('transaction aborted'));
    });
    return result;
  }

  const idb = {
    get: (store, id) => tx(store, 'readonly', s => reqToPromise(s[store].get(id))),
    getAll: (store) => tx(store, 'readonly', s => reqToPromise(s[store].getAll())),
    count: (store) => tx(store, 'readonly', s => reqToPromise(s[store].count())),
    put: (store, value) => tx(store, 'readwrite', s => reqToPromise(s[store].put(value))),
    putMany: (store, values) => tx(store, 'readwrite', s => { values.forEach(v => s[store].put(v)); return values.length; }),
    delete: (store, id) => tx(store, 'readwrite', s => reqToPromise(s[store].delete(id))),
    deleteMany: (store, ids) => tx(store, 'readwrite', s => { ids.forEach(id => s[store].delete(id)); return ids.length; }),
    clear: (store) => tx(store, 'readwrite', s => reqToPromise(s[store].clear())),
    byIndex: (store, index, value) => tx(store, 'readonly', s => reqToPromise(s[store].index(index).getAll(value))),
    keys: (store) => tx(store, 'readonly', s => reqToPromise(s[store].getAllKeys())),
    keysByIndex: (store, index, range) => tx(store, 'readonly', s => reqToPromise(s[store].index(index).getAllKeys(range))),
    countIndex: (store, index) => tx(store, 'readonly', s => reqToPromise(s[store].index(index).count())),
  };

  async function deleteDatabase() {
    const db = await openDB().catch(() => null);
    if (db) db.close();
    dbPromise = null;
    await reqToPromise(indexedDB.deleteDatabase(name));
  }

  return { name, version, stores, tx, idb, deleteDatabase };
}

export const SINGLE_DB = makeDB(DB_NAME, DB_VERSION, STORES);
export const SHADCHAN_DB = makeDB(SH_DB_NAME, SH_DB_VERSION, SH_STORES);

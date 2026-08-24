// IndexedDB wrapper (Promiseベース)
const DB_NAME = 'catHealthDB';
const DB_VERSION = 4;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('codeMaster')) {
        const store = db.createObjectStore('codeMaster', { keyPath: 'id', autoIncrement: true });
        store.createIndex('byCategoryCode', ['category', 'code'], { unique: true });
        store.createIndex('byCategory', 'category', { unique: false });
      }
      if (!db.objectStoreNames.contains('catMaster')) {
        db.createObjectStore('catMaster', { keyPath: 'code' });
      }
      if (!db.objectStoreNames.contains('foodMaster')) {
        db.createObjectStore('foodMaster', { keyPath: 'code' });
      }
      if (!db.objectStoreNames.contains('dailyLog')) {
        const store = db.createObjectStore('dailyLog', { keyPath: 'id', autoIncrement: true });
        store.createIndex('byCatDate', ['catCode', 'date'], { unique: true });
        store.createIndex('byCat', 'catCode', { unique: false });
      }
      if (!db.objectStoreNames.contains('feedingLog')) {
        const store = db.createObjectStore('feedingLog', { keyPath: 'id', autoIncrement: true });
        store.createIndex('byCatDate', ['catCode', 'date'], { unique: false });
        store.createIndex('byCat', 'catCode', { unique: false });
      }
      if (!db.objectStoreNames.contains('medicineMaster')) {
        db.createObjectStore('medicineMaster', { keyPath: 'code' });
      }
      if (!db.objectStoreNames.contains('medicineLog')) {
        const store = db.createObjectStore('medicineLog', { keyPath: 'id', autoIncrement: true });
        store.createIndex('byCatDate', ['catCode', 'date'], { unique: false });
        store.createIndex('byCat', 'catCode', { unique: false });
      }
      if (!db.objectStoreNames.contains('excretionLog')) {
        const store = db.createObjectStore('excretionLog', { keyPath: 'id', autoIncrement: true });
        store.createIndex('byCatDate', ['catCode', 'date'], { unique: false });
        store.createIndex('byCat', 'catCode', { unique: false });
      }
      if (!db.objectStoreNames.contains('recipeMaster')) {
        db.createObjectStore('recipeMaster', { keyPath: 'code' });
      }
      if (!db.objectStoreNames.contains('memoLog')) {
        const store = db.createObjectStore('memoLog', { keyPath: 'id', autoIncrement: true });
        store.createIndex('byCatDate', ['catCode', 'date'], { unique: false });
        store.createIndex('byCat', 'catCode', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

function tx(storeNames, mode) {
  return openDB().then(db => db.transaction(storeNames, mode));
}

export async function getAll(storeName) {
  const t = await tx(storeName, 'readonly');
  const rows = await new Promise((resolve, reject) => {
    const req = t.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // seq（登録順を表す値）を持つレコードは登録順に並べ替える。
  // seqを持たないストア（ログ系など）のレコードは全て0扱いになり、安定ソートにより元の並び順のまま変化しない。
  return rows.slice().sort((a, b) => ((a && a.seq) || 0) - ((b && b.seq) || 0));
}

export async function get(storeName, key) {
  const t = await tx(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const req = t.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function put(storeName, value) {
  const t = await tx(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = t.objectStore(storeName).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function remove(storeName, key) {
  const t = await tx(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = t.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearStore(storeName) {
  const t = await tx(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = t.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getByIndex(storeName, indexName, query) {
  const t = await tx(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const req = t.objectStore(storeName).index(indexName).getAll(query);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const STORES = ['codeMaster', 'catMaster', 'foodMaster', 'dailyLog', 'feedingLog', 'medicineMaster', 'medicineLog', 'excretionLog', 'recipeMaster', 'memoLog'];

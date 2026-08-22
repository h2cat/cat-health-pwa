import { getAll, put, clearStore, STORES } from './db.js';

export async function exportAll() {
  const data = {};
  for (const store of STORES) {
    data[store] = await getAll(store);
  }
  data.exportedAt = new Date().toISOString();
  data.version = 1;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `cat-health-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importAll(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  for (const store of STORES) {
    if (!Array.isArray(data[store])) continue;
    await clearStore(store);
    for (const row of data[store]) {
      await put(store, row);
    }
  }
}

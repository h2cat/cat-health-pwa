import { getAll, put, clearStore, STORES } from './db.js';
import { downloadZip, readZip } from './zip.js';

export async function exportAll() {
  await exportSelected(STORES);
}

// エクスポートファイル名の日時サフィックス（ローカル時刻、YmdHis形式。例: 20260824153045）
function formatTimestampYmdHis(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// storeNames: エクスポートしたいストア名の配列（チェックボックスで選択されたもの）
// ZIP内にストアごとのJSONファイル(例: feedingLog.json)＋meta.jsonをまとめる
export async function exportSelected(storeNames) {
  const stamp = formatTimestampYmdHis(new Date());
  const entries = [];
  for (const store of storeNames) {
    const rows = await getAll(store);
    entries.push({ name: `${store}.json`, text: JSON.stringify(rows, null, 2) });
  }
  entries.push({
    name: 'meta.json',
    text: JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, stores: storeNames }, null, 2)
  });
  await downloadZip(entries, `cat-health-backup-${stamp}.zip`);
}

export async function importAll(file) {
  const isZip = /\.zip$/i.test(file.name) || file.type === 'application/zip';
  if (isZip) {
    const buf = await file.arrayBuffer();
    const files = await readZip(buf);
    const dataByStore = {};
    for (const f of files) {
      const m = f.name.match(/^([^/]+)\.json$/);
      if (!m || m[1] === 'meta') continue;
      try { dataByStore[m[1]] = JSON.parse(f.text); } catch (e) { /* 壊れたファイルは無視 */ }
    }
    for (const store of STORES) {
      if (!Array.isArray(dataByStore[store])) continue;
      await clearStore(store);
      for (const row of dataByStore[store]) {
        await put(store, row);
      }
    }
    return;
  }

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

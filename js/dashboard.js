import { getAll, get, put, remove, getByIndex, clearStore, STORES } from './db.js';
import { escapeHtml, el, parseCaloriePer100gInput, normalizeFavoriteSourceCodes } from './utils.js';
import { initialCodeMaster, initialCatMaster, initialFoodMaster, initialMedicineMaster, initialRecipeMaster } from './initial-data.js';

export const FOOD_FORM_CATEGORY = 'FOOD_FORM';
export const FOOD_TYPE_CATEGORY = 'FOOD_TYPE';
export const MAKER_CATEGORY = 'MAKER';
export const STOOL_STATE_CATEGORY = 'STOOL_STATE';
export const VOMIT_STATE_CATEGORY = 'VOMIT_STATE';
export const MED_UNIT_CATEGORY = 'MED_UNIT';
export const MED_EFFECT_CATEGORY = 'MED_EFFECT';
export const DAILY_EVENT_CATEGORY = 'DAILY_EVENT';
export const MEMO_CATEGORY = 'MEMO_CATEGORY';

let expandedCodeCategory = null; // コードマスタのアコーディオンで開いている大分類
let addingCodeCategory = null; // コードマスタで「＋コード追加」の入力行を表示中の大分類
let editingCodeId = null; // コードマスタでインライン編集中の行のid
let showNewFoodForm = false; // 餌マスタで「＋新規作成」フォームを開いているか
let showNewRecipeForm = false; // レシピマスタで「＋新規作成」フォームを開いているか
let expandedFoodCode = null; // 餌マスタのアコーディオンで開いている餌のcode
let expandedRecipeCode = null; // レシピマスタのアコーディオンで開いているレシピのcode
let showNewMedicineForm = false; // 薬・サプリマスタで「＋新規作成」フォームを開いているか
let expandedMedicineCode = null; // 薬・サプリマスタのアコーディオンで開いている薬・サプリのcode

// 初回起動時／アップデート時のマスタ種seed
// js/initial-data.js の内容のうち、「まだ登録されていないもの」だけを追加する。
// 既にアプリ内で編集・削除したデータは上書きしない。
// マスタのinitial-data.jsとのマージ、旧データの補正、カロリーキャッシュの再集計などをまとめて行う。
// 「データコンバート」ボタン（IO画面）から手動で呼び出す想定（起動時の自動実行はしない）。
// 何回実行しても安全（差分がなければ何も変更しない）。変更件数をまとめて返す。
export async function seedDefaults() {
  const result = {
    codeAdded: await ensureCodeMaster(initialCodeMaster),
    catAdded: await ensureCatMaster(initialCatMaster),
    foodAdded: await ensureFoodMaster(initialFoodMaster),
    medicineAdded: await ensureMedicineMaster(initialMedicineMaster),
    recipeAdded: await ensureRecipeMaster(initialRecipeMaster),
    kindFlagFixed: await migrateMedicineKindFlag(),
    seqFixed: 0,
    kcalUpdated: 0
  };
  result.seqFixed += await reorderSeededSeq('foodMaster', initialFoodMaster);
  result.seqFixed += await reorderSeededSeq('recipeMaster', initialRecipeMaster);
  result.seqFixed += await reorderSeededSeq('medicineMaster', initialMedicineMaster);
  result.seqFixed += await reorderSeededSeq('catMaster', initialCatMaster);
  result.kcalUpdated = await syncDailyKcalCache();
  return result;
}

// 指定した猫・日付の摂取(INTAKE)カロリー合計をdailyLogにキャッシュする。
// 日々タブのカレンダーが月表示のたびに給餈ログを集計し直さなくて済むよう、
// 給餈の入力・編集・削除のタイミングで都度呼び出して最新化する。
export async function recomputeDailyKcal(catCode, date) {
  const feedRows = await getByIndex('feedingLog', 'byCatDate', [catCode, date]);
  const kcal = Math.round(feedRows.reduce((s, e) => s + (e.kind === 'INTAKE' ? (e.calorie || 0) : 0), 0) * 10) / 10;
  const rows = await getByIndex('dailyLog', 'byCatDate', [catCode, date]);
  const existing = rows[0] || null;
  const data = existing ? { ...existing, kcal } : { catCode, date, kcal };
  await put('dailyLog', data);
}

// 起動時に給餈ログ全体から日別カロリー合計を再集計し、dailyLog.kcalキャッシュを最新状態にする。
// 給餈ログ全件を1回のクエリでまとめて取得して集計するだけなので、月ごとに再集計するより十分軽い。
export async function syncDailyKcalCache() {
  let updated = 0;
  const feedRows = await getAll('feedingLog');
  const totalsByKey = new Map(); // "catCode|date" -> kcal合計
  for (const e of feedRows) {
    if (e.kind !== 'INTAKE') continue;
    const key = `${e.catCode}|${e.date}`;
    totalsByKey.set(key, Math.round(((totalsByKey.get(key) || 0) + (e.calorie || 0)) * 10) / 10);
  }
  const dailyRows = await getAll('dailyLog');
  const dailyByKey = new Map(dailyRows.map(r => [`${r.catCode}|${r.date}`, r]));
  const seenKeys = new Set();
  for (const [key, kcal] of totalsByKey) {
    seenKeys.add(key);
    const existing = dailyByKey.get(key);
    if (existing) {
      if (existing.kcal !== kcal) { await put('dailyLog', { ...existing, kcal }); updated++; }
    } else {
      const [catCode, date] = key.split('|');
      await put('dailyLog', { catCode, date, kcal });
      updated++;
    }
  }
  // 給餈記録が無くなった日はキャッシュを0に戻す
  for (const row of dailyRows) {
    const key = `${row.catCode}|${row.date}`;
    if (!seenKeys.has(key) && row.kcal) { await put('dailyLog', { ...row, kcal: 0 }); updated++; }
  }
  return updated;
}

// 新規追加時のseqはDate.now()（十分大きい値）を使うため、それより十分小さいこの値未満のseqは
// 「登録順ではない旧移行処理で割り振られた値」とみなして振り直し対象にする。
const LEGACY_SEQ_THRESHOLD = 1_000_000;

// seq(登録順を表す値)を、initial-data.js内の記載順（＝実際に登録された意味のある並び）を基準に振り直す（1回限りの移行処理）。
// 対象はseq未設定、または旧移行処理（コード順で割り振られたもの）のレコードのみ。
// Date.now()ベースのseq(この機能追加後に新規追加されたもの)は十分大きい値なので対象にならない。
async function reorderSeededSeq(storeName, entries) {
  let fixed = 0;
  const seededCodes = new Set(entries.map(e => e.code));
  let n = 1;
  // 1) initial-data.js記載順に振り直す（既に同じ値なら書き込まない＝再実行しても差分0件になる）
  for (const e of entries) {
    const row = await get(storeName, e.code);
    if (row && (row.seq == null || row.seq < LEGACY_SEQ_THRESHOLD)) {
      if (row.seq !== n) {
        row.seq = n;
        await put(storeName, row);
        fixed++;
      }
    }
    n++;
  }
  // 2) 初期データに無い自作の追加分（旧移行処理のseqが残っているもの）は、初期データの後ろに回す
  const rows = await getAll(storeName);
  const legacyExtras = rows.filter(row => !seededCodes.has(row.code) && (row.seq == null || row.seq < LEGACY_SEQ_THRESHOLD));
  for (const row of legacyExtras) {
    if (row.seq !== n) {
      row.seq = n;
      await put(storeName, row);
      fixed++;
    }
    n++;
  }
  return fixed;
}

// 薬・サプリのフラグ(kindFlag)未設定の既存データを「薬」に一括設定する（1回限りの移行処理）
async function migrateMedicineKindFlag() {
  let fixed = 0;
  const medicines = await getAll('medicineMaster');
  for (const m of medicines) {
    if (!m.kindFlag) {
      m.kindFlag = 'DRUG';
      await put('medicineMaster', m);
      fixed++;
    }
  }
  return fixed;
}

async function ensureCodeMaster(entries) {
  let added = 0;
  const existing = await getAll('codeMaster');
  const existingKeys = new Set(existing.map(r => `${r.category}::${r.code}`));
  for (const e of entries) {
    if (!existingKeys.has(`${e.category}::${e.code}`)) {
      await put('codeMaster', { category: e.category, code: e.code, name: e.name, abbr: e.abbr || '' });
      added++;
    }
  }
  return added;
}

async function ensureCatMaster(entries) {
  let added = 0;
  for (const e of entries) {
    const existing = await get('catMaster', e.code);
    if (!existing) { await put('catMaster', { ...e }); added++; }
  }
  return added;
}

async function ensureFoodMaster(entries) {
  let added = 0;
  for (const e of entries) {
    const existing = await get('foodMaster', e.code);
    if (!existing) { await put('foodMaster', { ...e }); added++; }
  }
  return added;
}

async function ensureMedicineMaster(entries) {
  let added = 0;
  for (const e of entries) {
    const existing = await get('medicineMaster', e.code);
    if (!existing) { await put('medicineMaster', { ...e }); added++; }
  }
  return added;
}

async function ensureRecipeMaster(entries) {
  let added = 0;
  for (const e of entries) {
    const existing = await get('recipeMaster', e.code);
    if (!existing) { await put('recipeMaster', { ...e }); added++; }
  }
  return added;
}

export async function renderDashboard(container, callbacks) {
  container.innerHTML = `
    <div class="subtabs">
      <button data-sub="food" class="subtab active" title="餌マスタ">🍽️</button>
      <button data-sub="recipe" class="subtab" title="レシピ">📖</button>
      <button data-sub="medicine" class="subtab" title="薬・サプリマスタ">💊</button>
      <button data-sub="code" class="subtab" title="コードマスタ">🏷️</button>
      <button data-sub="cat" class="subtab" title="猫マスタ">🐱</button>
      <button data-sub="io" class="subtab" title="データ入出力">📁</button>
    </div>
    <div id="dashContent"></div>
  `;
  const subtabs = container.querySelectorAll('.subtab');
  const content = container.querySelector('#dashContent');
  subtabs.forEach(btn => btn.addEventListener('click', () => {
    subtabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showSub(btn.dataset.sub);
  }));
  async function showSub(sub) {
    if (sub === 'code') await renderCodeMaster(content);
    else if (sub === 'cat') await renderCatMaster(content, callbacks);
    else if (sub === 'food') await renderFoodMaster(content);
    else if (sub === 'recipe') await renderRecipeMaster(content);
    else if (sub === 'medicine') await renderMedicineMaster(content);
    else if (sub === 'io') await renderIO(content, callbacks);
  }
  await showSub('food');
}

// ===== コードマスタ =====
async function renderCodeMaster(content) {
  const rows = await getAll('codeMaster');
  const categories = {};
  rows.forEach(r => {
    if (!categories[r.category]) categories[r.category] = { header: null, items: [] };
    if (r.code === '') categories[r.category].header = r;
    else categories[r.category].items.push(r);
  });

  let html = `<div class="panel">
    <div class="panel-header">
      <h3>コードマスタ</h3>
      <button id="addCategoryBtn" class="btn-small">＋大分類追加</button>
    </div>`;

  Object.keys(categories).forEach(cat => {
    const c = categories[cat];
    const headerName = c.header ? c.header.name : cat;
    const isOpen = expandedCodeCategory === cat;
    html += `<div class="card accordion-card">
      <button class="accordion-header" data-toggle-category="${escapeHtml(cat)}">
        <span>${escapeHtml(headerName)} <span class="muted">(${escapeHtml(cat)}・${c.items.length}件)</span></span>
        <span class="accordion-arrow">${isOpen ? '▼' : '▶'}</span>
      </button>`;
    if (isOpen) {
      html += `<div class="accordion-body">`;
      if (addingCodeCategory === cat) {
        html += `<div class="card">
          <div class="card-title">コード追加</div>
          <div class="field"><label>コード</label><input id="nc_code" type="text" class="required-input"></div>
          <div class="field"><label>名称</label><input id="nc_name" type="text" class="required-input"></div>
          <div class="field"><label>略称</label><input id="nc_abbr" type="text"></div>
          <div class="form-actions">
            <button id="nc_save" class="btn-primary">追加</button>
            <button id="nc_cancel" class="btn-small">キャンセル</button>
          </div>
        </div>`;
      }
      const editingItem = c.items.find(i => i.id === editingCodeId);
      if (editingItem) {
        html += `<div class="card">
          <div class="card-title">コード編集: ${escapeHtml(editingItem.code)}</div>
          <div class="field"><label>コード</label><input value="${escapeHtml(editingItem.code)}" disabled></div>
          <div class="field"><label>名称</label><input id="ec_name" type="text" class="required-input" value="${escapeHtml(editingItem.name)}"></div>
          <div class="field"><label>略称</label><input id="ec_abbr" type="text" value="${escapeHtml(editingItem.abbr || '')}"></div>
          <div class="form-actions">
            <button id="ec_save" class="btn-primary" data-save-code="${editingItem.id}">更新</button>
            <button id="ec_cancel" class="btn-small">キャンセル</button>
          </div>
        </div>`;
      }
      html += `<table class="tbl"><thead><tr><th>コード</th><th>名称</th><th>略称</th><th></th></tr></thead><tbody>`;
      c.items.forEach(item => {
        html += `<tr>
          <td>${escapeHtml(item.code)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.abbr || '-')}</td>
          <td class="actions">
            <button class="btn-tiny icon-btn" data-edit-code="${item.id}" title="編集">✏️</button>
            <button class="btn-tiny icon-btn danger" data-del-code="${item.id}" title="削除">🗑️</button>
          </td>
        </tr>`;
      });
      html += `</tbody></table>
        <div class="actions">
          ${addingCodeCategory === cat ? '' : `<button class="btn-small" data-add-code="${escapeHtml(cat)}">＋コード追加</button>`}
          <button class="btn-small danger" data-del-header="${escapeHtml(cat)}">大分類削除</button>
        </div>
      </div>`;
    }
    html += `</div>`;
  });
  html += `</div>`;
  content.innerHTML = html;

  content.querySelector('#addCategoryBtn').addEventListener('click', async () => {
    const catKey = prompt('大分類コード（半角英数、例: FOOD_FORM）を入力してください');
    if (!catKey) return;
    if (categories[catKey]) { alert('既に存在する大分類コードです'); return; }
    const name = prompt('大分類名称を入力してください');
    if (!name) return;
    await put('codeMaster', { category: catKey, code: '', name });
    expandedCodeCategory = catKey;
    renderCodeMaster(content);
  });

  content.querySelectorAll('[data-toggle-category]').forEach(btn => btn.addEventListener('click', () => {
    const cat = btn.dataset.toggleCategory;
    expandedCodeCategory = expandedCodeCategory === cat ? null : cat;
    addingCodeCategory = null;
    editingCodeId = null;
    renderCodeMaster(content);
  }));

  content.querySelectorAll('[data-add-code]').forEach(btn => btn.addEventListener('click', () => {
    addingCodeCategory = btn.dataset.addCode;
    editingCodeId = null;
    renderCodeMaster(content);
  }));

  const ncSave = content.querySelector('#nc_save');
  if (ncSave) ncSave.addEventListener('click', async () => {
    const cat = addingCodeCategory;
    const code = content.querySelector('#nc_code').value.trim();
    const name = content.querySelector('#nc_name').value.trim();
    const abbr = content.querySelector('#nc_abbr').value.trim();
    if (!code || !name) { alert('コードと名称は必須です'); return; }
    const exists = categories[cat].items.some(i => i.code === code);
    if (exists) { alert('既に存在するコードです'); return; }
    await put('codeMaster', { category: cat, code, name, abbr });
    addingCodeCategory = null;
    renderCodeMaster(content);
  });
  const ncCancel = content.querySelector('#nc_cancel');
  if (ncCancel) ncCancel.addEventListener('click', () => {
    addingCodeCategory = null;
    renderCodeMaster(content);
  });

  content.querySelectorAll('[data-edit-code]').forEach(btn => btn.addEventListener('click', () => {
    editingCodeId = Number(btn.dataset.editCode);
    addingCodeCategory = null;
    renderCodeMaster(content);
  }));

  const ecCancel = content.querySelector('#ec_cancel');
  if (ecCancel) ecCancel.addEventListener('click', () => {
    editingCodeId = null;
    renderCodeMaster(content);
  });

  const ecSave = content.querySelector('#ec_save');
  if (ecSave) ecSave.addEventListener('click', async () => {
    const id = Number(ecSave.dataset.saveCode);
    const row = await get('codeMaster', id);
    const name = content.querySelector('#ec_name').value.trim();
    const abbr = content.querySelector('#ec_abbr').value.trim();
    if (!name) { alert('名称は必須です'); return; }
    row.name = name;
    row.abbr = abbr;
    await put('codeMaster', row);
    editingCodeId = null;
    renderCodeMaster(content);
  });

  content.querySelectorAll('[data-del-code]').forEach(btn => btn.addEventListener('click', async () => {
    const id = Number(btn.dataset.delCode);
    const row = await get('codeMaster', id);
    const foods = await getAll('foodMaster');
    const usedInFood = foods.some(f => f.formCode === row.code || f.typeCode === row.code || f.makerCode === row.code);
    const excretions = await getAll('excretionLog');
    const usedInExcretion = excretions.some(e => (e.stateCodes || (e.stateCode ? [e.stateCode] : [])).includes(row.code));
    const medicines = await getAll('medicineMaster');
    const usedInMedicine = medicines.some(m => m.unitCode === row.code || m.effectCode === row.code);
    const dailyLogs = await getAll('dailyLog');
    const usedInDaily = dailyLogs.some(d => (d.events || []).includes(row.code));
    if (usedInFood || usedInExcretion || usedInMedicine || usedInDaily) { alert('この項目は既存データで使用されているため削除できません'); return; }
    if (!confirm(`「${row.name}」を削除しますか？`)) return;
    await remove('codeMaster', id);
    renderCodeMaster(content);
  }));

  content.querySelectorAll('[data-del-header]').forEach(btn => btn.addEventListener('click', async () => {
    const cat = btn.dataset.delHeader;
    const c = categories[cat];
    if (c.items.length > 0) { alert('この大分類にはコードが残っているため削除できません'); return; }
    if (!c.header) return;
    if (!confirm(`大分類「${c.header.name}」を削除しますか？`)) return;
    await remove('codeMaster', c.header.id);
    if (expandedCodeCategory === cat) expandedCodeCategory = null;
    renderCodeMaster(content);
  }));
}

// ===== 猫マスタ =====
async function renderCatMaster(content, callbacks) {
  const cats = await getAll('catMaster');
  const foods = await getAll('foodMaster');
  const recipes = await getAll('recipeMaster');
  const sourceName = srcCode => {
    if (srcCode.startsWith('R:')) {
      const r = recipes.find(x => x.code === srcCode.slice(2));
      return r ? r.name : srcCode.slice(2);
    }
    const code = srcCode.startsWith('F:') ? srcCode.slice(2) : srcCode;
    const f = foods.find(x => x.code === code);
    return f ? f.name : code;
  };

  let html = `<div class="panel">
    <div class="panel-header"><h3>猫マスタ</h3></div>`;
  cats.forEach(cat => {
    const favs = normalizeFavoriteSourceCodes(cat);
    html += `<div class="card">
      <div class="card-title">${escapeHtml(cat.name)} <span class="muted">(${escapeHtml(cat.code)})</span></div>
      <div class="kv">生年月日: ${escapeHtml(cat.birthDate || '-')}</div>
      <div class="kv">性別: ${escapeHtml(cat.sex || '-')}</div>
      <div class="kv">お気に入り餌・レシピ: ${favs.length ? escapeHtml(favs.map(sourceName).join('、')) : '-'}</div>
      <div class="kv">メモ: ${escapeHtml(cat.memo || '-')}</div>
      <div class="actions">
        <button class="btn-small icon-btn" data-edit-cat="${escapeHtml(cat.code)}" title="編集">✏️</button>
        <button class="btn-small icon-btn danger" data-del-cat="${escapeHtml(cat.code)}" title="削除">🗑️</button>
      </div>
    </div>`;
  });
  html += `<div class="card">
    <div class="card-title">新規猫を追加</div>
    <div id="catForm"></div>
  </div></div>`;
  content.innerHTML = html;

  renderCatForm(content.querySelector('#catForm'), null, callbacks, () => renderCatMaster(content, callbacks), foods, recipes, () => renderCatMaster(content, callbacks));

  content.querySelectorAll('[data-edit-cat]').forEach(btn => btn.addEventListener('click', async () => {
    const code = btn.dataset.editCat;
    const cat = await get('catMaster', code);
    const formHost = el(`<div class="card"><div class="card-title">猫編集: ${escapeHtml(cat.name)}</div><div></div></div>`);
    btn.closest('.card').replaceWith(formHost);
    renderCatForm(formHost.querySelector('div:last-child'), cat, callbacks, () => renderCatMaster(content, callbacks), foods, recipes, () => renderCatMaster(content, callbacks));
  }));

  content.querySelectorAll('[data-del-cat]').forEach(btn => btn.addEventListener('click', async () => {
    const code = btn.dataset.delCat;
    const daily = await getByIndex('dailyLog', 'byCat', code);
    const feeding = await getByIndex('feedingLog', 'byCat', code);
    const medicine = await getByIndex('medicineLog', 'byCat', code);
    const excretion = await getByIndex('excretionLog', 'byCat', code);
    const memo = await getByIndex('memoLog', 'byCat', code);
    if (daily.length > 0 || feeding.length > 0 || medicine.length > 0 || excretion.length > 0 || memo.length > 0) {
      alert('この猫には入力済みのデータがあるため削除できません');
      return;
    }
    if (!confirm('この猫を削除しますか？')) return;
    await remove('catMaster', code);
    if (callbacks && callbacks.onCatsChanged) callbacks.onCatsChanged();
    renderCatMaster(content, callbacks);
  }));
}

function renderCatForm(host, existing, callbacks, onSaved, foods, recipes, onCancel) {
  const isEdit = !!existing;
  const foodList = foods || [];
  const recipeList = recipes || [];
  const existingFavs = isEdit ? normalizeFavoriteSourceCodes(existing) : [];

  function favOptionsHtml(selectedValue) {
    let optHtml = '<option value="">（未選択）</option>';
    const recipeOpts = recipeList
      // 非表示のレシピでも、既にお気に入り登録済みなら選択肢から消えないよう表示する
      .filter(r => r.display !== false || `R:${r.code}` === selectedValue)
      .map(r => `<option value="R:${escapeHtml(r.code)}" ${`R:${r.code}` === selectedValue ? 'selected' : ''}>${escapeHtml(r.name)}</option>`)
      .join('');
    const foodOpts = foodList
      // 非表示の餌でも、既にお気に入り登録済みなら選択肢から消えないよう表示する
      .filter(f => f.display !== false || `F:${f.code}` === selectedValue)
      .map(f => `<option value="F:${escapeHtml(f.code)}" ${`F:${f.code}` === selectedValue ? 'selected' : ''}>${escapeHtml(f.name)}</option>`)
      .join('');
    if (recipeOpts) optHtml += `<optgroup label="レシピ">${recipeOpts}</optgroup>`;
    if (foodOpts) optHtml += `<optgroup label="餌">${foodOpts}</optgroup>`;
    return optHtml;
  }

  host.innerHTML = `
    <div class="field"><label>コード</label><input id="f_code" class="required-input" ${isEdit ? 'disabled' : ''} value="${isEdit ? escapeHtml(existing.code) : ''}"></div>
    <div class="field"><label>名前</label><input id="f_name" class="required-input" value="${isEdit ? escapeHtml(existing.name) : ''}"></div>
    <div class="field"><label>生年月日</label><input id="f_birth" type="date" value="${isEdit ? escapeHtml(existing.birthDate || '') : ''}"></div>
    <div class="field"><label>性別</label>
      <select id="f_sex">
        <option value="">未設定</option>
        <option value="オス" ${isEdit && existing.sex === 'オス' ? 'selected' : ''}>オス</option>
        <option value="メス" ${isEdit && existing.sex === 'メス' ? 'selected' : ''}>メス</option>
      </select>
    </div>
    <div class="field"><label>お気に入り餌・レシピ（最大3件）</label>
      <select id="f_fav1">${favOptionsHtml(existingFavs[0])}</select>
      <select id="f_fav2">${favOptionsHtml(existingFavs[1])}</select>
      <select id="f_fav3">${favOptionsHtml(existingFavs[2])}</select>
    </div>
    <div class="field"><label>メモ</label><textarea id="f_memo">${isEdit ? escapeHtml(existing.memo || '') : ''}</textarea></div>
    <div class="form-actions">
      <button id="f_save" class="btn-primary">${isEdit ? '更新' : '追加'}</button>
      <button id="f_cancel" class="btn-small">キャンセル</button>
    </div>
  `;

  if (onCancel) host.querySelector('#f_cancel').addEventListener('click', onCancel);

  host.querySelector('#f_save').addEventListener('click', async () => {
    const code = host.querySelector('#f_code').value.trim();
    const name = host.querySelector('#f_name').value.trim();
    if (!code || !name) { alert('コードと名前は必須です'); return; }
    if (!isEdit) {
      const existingCat = await get('catMaster', code);
      if (existingCat) { alert('既に存在するコードです'); return; }
    }
    const favRaw = [
      host.querySelector('#f_fav1').value,
      host.querySelector('#f_fav2').value,
      host.querySelector('#f_fav3').value
    ].filter(v => v);
    const favoriteSourceCodes = Array.from(new Set(favRaw)).slice(0, 3);
    const catData = {
      code,
      name,
      birthDate: host.querySelector('#f_birth').value,
      sex: host.querySelector('#f_sex').value,
      favoriteSourceCodes,
      memo: host.querySelector('#f_memo').value,
      seq: isEdit ? existing.seq : Date.now()
    };
    await put('catMaster', catData);
    if (callbacks && callbacks.onCatsChanged) callbacks.onCatsChanged();
    if (onSaved) onSaved();
    else {
      host.closest('.card').querySelectorAll('input,select,textarea').forEach(i => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
      alert('保存しました');
    }
  });
}

// ===== 餌マスタ =====
async function renderFoodMaster(content) {
  const foods = await getAll('foodMaster');
  const forms = await getByIndex('codeMaster', 'byCategory', FOOD_FORM_CATEGORY);
  const formCodes = forms.filter(f => f.code !== '');
  const types = await getByIndex('codeMaster', 'byCategory', FOOD_TYPE_CATEGORY);
  const typeCodes = types.filter(t => t.code !== '');
  const makers = await getByIndex('codeMaster', 'byCategory', MAKER_CATEGORY);
  const makerCodes = makers.filter(m => m.code !== '');

  const makerOptionsHtml = makerCodes.map(m => `<option value="${escapeHtml(m.code)}">${escapeHtml(m.name)}</option>`).join('');
  const formOptionsHtml = formCodes.map(f => `<option value="${escapeHtml(f.code)}">${escapeHtml(f.name)}</option>`).join('');
  const typeOptionsHtml = typeCodes.map(t => `<option value="${escapeHtml(t.code)}">${escapeHtml(t.name)}</option>`).join('');

  content.innerHTML = `<div class="panel">
    <div class="panel-header"><h3>餌マスタ</h3><button id="foodNewBtn" class="btn-small">${showNewFoodForm ? '－閉じる' : '＋新規作成'}</button></div>
    ${showNewFoodForm ? '<div class="card"><div class="card-title">新規餌を追加</div><div id="foodForm"></div></div>' : ''}
    <div class="feed-filter">
      <input id="foodMasterSearch" type="text" placeholder="餌名・略称で検索">
      <select id="foodMasterFilterMaker"><option value="">メーカー(すべて)</option>${makerOptionsHtml}</select>
      <select id="foodMasterFilterForm"><option value="">形態(すべて)</option>${formOptionsHtml}</select>
      <select id="foodMasterFilterType"><option value="">種類(すべて)</option>${typeOptionsHtml}</select>
      <select id="foodMasterFilterDisplay"><option value="">表示/非表示(すべて)</option><option value="visible">表示のみ</option><option value="hidden">非表示のみ</option></select>
    </div>
    <div id="foodListHost"></div>
  </div>`;

  content.querySelector('#foodNewBtn').addEventListener('click', () => {
    showNewFoodForm = !showNewFoodForm;
    renderFoodMaster(content);
  });

  const listHost = content.querySelector('#foodListHost');
  const searchInput = content.querySelector('#foodMasterSearch');
  const filterMaker = content.querySelector('#foodMasterFilterMaker');
  const filterForm = content.querySelector('#foodMasterFilterForm');
  const filterType = content.querySelector('#foodMasterFilterType');
  const filterDisplay = content.querySelector('#foodMasterFilterDisplay');

  function getFilteredFoods() {
    const q = (searchInput.value || '').trim().toLowerCase();
    return foods.filter(f => {
      const visible = f.display !== false;
      if (filterDisplay.value === 'visible' && !visible) return false;
      if (filterDisplay.value === 'hidden' && visible) return false;
      if (filterMaker.value && f.makerCode !== filterMaker.value) return false;
      if (filterForm.value && f.formCode !== filterForm.value) return false;
      if (filterType.value && f.typeCode !== filterType.value) return false;
      if (q && !(f.name || '').toLowerCase().includes(q) && !(f.abbr || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function renderList() {
    const filtered = getFilteredFoods();
    let html = '';
    filtered.forEach(f => {
      const formName = formCodes.find(fc => fc.code === f.formCode);
      const typeName = typeCodes.find(tc => tc.code === f.typeCode);
      const makerName = makerCodes.find(mc => mc.code === f.makerCode);
      const visible = f.display !== false;
      const isOpen = expandedFoodCode === f.code;
      html += `<div class="card accordion-card ${visible ? '' : 'hidden-item'}">
        <div class="accordion-header">
          <button class="accordion-name-btn" data-toggle-food="${escapeHtml(f.code)}">${escapeHtml(f.name)}${visible ? '' : '<span class="hidden-badge">非表示</span>'}</button>
          <div class="accordion-header-actions">
            <button class="btn-tiny icon-btn eye-btn ${visible ? '' : 'eye-off'}" data-toggle-display-food="${escapeHtml(f.code)}" title="${visible ? '非表示にする' : '表示に戻す'}">${visible ? '👓' : '🕶️'}</button>
            <span class="accordion-arrow">${isOpen ? '▼' : '▶'}</span>
          </div>
        </div>
        ${isOpen ? `<div class="accordion-body">
          <div class="kv">コード: ${escapeHtml(f.code)}</div>
          <div class="kv">略称: ${escapeHtml(f.abbr || '-')}</div>
          <div class="kv">メーカー: ${escapeHtml(makerName ? makerName.name : '-')}</div>
          <div class="kv">100gあたりカロリー: ${escapeHtml(f.caloriePer100g)} kcal</div>
          <div class="kv">形態: ${escapeHtml(formName ? formName.name : '-')}</div>
          <div class="kv">種類: ${escapeHtml(typeName ? typeName.name : '-')}</div>
          <div class="kv">給仕デフォルト量: ${escapeHtml(f.defaultAmountG)} g</div>
          <div class="actions">
            <button class="btn-small icon-btn" data-edit-food="${escapeHtml(f.code)}" title="編集">✏️</button>
            <button class="btn-small icon-btn danger" data-del-food="${escapeHtml(f.code)}" title="削除">🗑️</button>
          </div>
        </div>` : ''}
      </div>`;
    });
    listHost.innerHTML = html || '<div class="muted">該当する餌がありません</div>';

    listHost.querySelectorAll('[data-toggle-food]').forEach(btn => btn.addEventListener('click', () => {
      const code = btn.dataset.toggleFood;
      expandedFoodCode = expandedFoodCode === code ? null : code;
      renderList();
    }));

    listHost.querySelectorAll('[data-toggle-display-food]').forEach(btn => btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const code = btn.dataset.toggleDisplayFood;
      const f = foods.find(x => x.code === code);
      if (!f) return;
      f.display = f.display === false ? true : false;
      await put('foodMaster', f);
      renderList();
    }));

    listHost.querySelectorAll('[data-edit-food]').forEach(btn => btn.addEventListener('click', async () => {
      const code = btn.dataset.editFood;
      const f = await get('foodMaster', code);
      const formHost = el(`<div class="card"><div class="card-title">餌編集: ${escapeHtml(f.name)}</div><div></div></div>`);
      btn.closest('.card').replaceWith(formHost);
      renderFoodForm(formHost.querySelector('div:last-child'), f, formCodes, typeCodes, makerCodes, () => renderFoodMaster(content), () => renderFoodMaster(content));
    }));

    listHost.querySelectorAll('[data-del-food]').forEach(btn => btn.addEventListener('click', async () => {
      const code = btn.dataset.delFood;
      const feeding = await getAll('feedingLog');
      const usedInFeeding = feeding.some(x => x.foodCode === code || x.sourceCode === code || (x.breakdown || []).some(b => b.foodCode === code));
      const recipes = await getAll('recipeMaster');
      const usedInRecipes = recipes.some(r => (r.components || []).some(c => c.foodCode === code));
      if (usedInFeeding || usedInRecipes) { alert('この餌は使用中のため削除できません'); return; }
      if (!confirm('この餌を削除しますか？')) return;
      await remove('foodMaster', code);
      renderFoodMaster(content);
    }));
  }

  searchInput.addEventListener('input', renderList);
  filterMaker.addEventListener('change', renderList);
  filterForm.addEventListener('change', renderList);
  filterType.addEventListener('change', renderList);
  filterDisplay.addEventListener('change', renderList);
  renderList();

  if (showNewFoodForm) {
    renderFoodForm(content.querySelector('#foodForm'), null, formCodes, typeCodes, makerCodes, () => { showNewFoodForm = false; renderFoodMaster(content); }, () => { showNewFoodForm = false; renderFoodMaster(content); });
  }
}

function renderFoodForm(host, existing, formCodes, typeCodes, makerCodes, onSaved, onCancel) {
  const isEdit = !!existing;
  const options = formCodes.map(fc => `<option value="${escapeHtml(fc.code)}" ${isEdit && existing.formCode === fc.code ? 'selected' : ''}>${escapeHtml(fc.name)}</option>`).join('');
  const typeOptions = typeCodes.map(tc => `<option value="${escapeHtml(tc.code)}" ${isEdit && existing.typeCode === tc.code ? 'selected' : ''}>${escapeHtml(tc.name)}</option>`).join('');
  const makerOptions = makerCodes.map(mc => `<option value="${escapeHtml(mc.code)}" ${isEdit && existing.makerCode === mc.code ? 'selected' : ''}>${escapeHtml(mc.name)}</option>`).join('');
  host.innerHTML = `
    <div class="field"><label>コード</label><input id="ff_code" class="required-input" ${isEdit ? 'disabled' : ''} value="${isEdit ? escapeHtml(existing.code) : ''}"></div>
    <div class="field"><label>メーカー</label><select id="ff_maker"><option value="">未選択</option>${makerOptions || ''}</select>${makerCodes.length === 0 ? '<span class="muted">コードマスタの「メーカー」にコードを追加してください</span>' : ''}</div>
    <div class="field"><label>名称</label><input id="ff_name" class="required-input" value="${isEdit ? escapeHtml(existing.name) : ''}"></div>
    <div class="field"><label>略称（ログ表示用）</label><input id="ff_abbr" value="${isEdit ? escapeHtml(existing.abbr || '') : ''}"></div>
    <div class="field"><label>カロリー</label><input id="ff_cal" type="text" placeholder="例: 350 または 75/85" value="${isEdit ? existing.caloriePer100g : ''}">
      <span class="muted">100gあたりのkcal、または「小袋のkcal/内容量g」（例: 75/85）で入力可</span>
      <span id="ff_cal_preview" class="muted"></span>
    </div>
    <div class="field"><label>形態</label><select id="ff_form"><option value="">未選択</option>${options}</select></div>
    <div class="field"><label>種類</label><select id="ff_type"><option value="">未選択</option>${typeOptions}</select></div>
    <div class="field"><label>給仕デフォルト量(g)</label><input id="ff_default" type="number" step="0.1" value="${isEdit ? existing.defaultAmountG : ''}"></div>
    <div class="form-actions">
      <button id="ff_save" class="btn-primary">${isEdit ? '更新' : '追加'}</button>
      <button id="ff_cancel" class="btn-small">キャンセル</button>
    </div>
  `;

  if (onCancel) host.querySelector('#ff_cancel').addEventListener('click', onCancel);

  const calInput = host.querySelector('#ff_cal');
  const calPreview = host.querySelector('#ff_cal_preview');
  function updateCalPreview() {
    const raw = calInput.value.trim();
    if (!raw) { calPreview.textContent = ''; return; }
    const per100g = parseCaloriePer100gInput(raw);
    calPreview.textContent = raw.includes('/') ? `→ 100gあたり ${per100g} kcal` : '';
  }
  calInput.addEventListener('input', updateCalPreview);
  updateCalPreview();

  host.querySelector('#ff_save').addEventListener('click', async () => {
    const code = host.querySelector('#ff_code').value.trim();
    const name = host.querySelector('#ff_name').value.trim();
    if (!code || !name) { alert('コードと名称は必須です'); return; }
    if (!isEdit) {
      const existingFood = await get('foodMaster', code);
      if (existingFood) { alert('既に存在するコードです'); return; }
    }
    const foodData = {
      code,
      makerCode: host.querySelector('#ff_maker').value,
      name,
      abbr: host.querySelector('#ff_abbr').value.trim(),
      caloriePer100g: parseCaloriePer100gInput(calInput.value),
      formCode: host.querySelector('#ff_form').value,
      typeCode: host.querySelector('#ff_type').value,
      defaultAmountG: Number(host.querySelector('#ff_default').value) || 0,
      seq: isEdit ? existing.seq : Date.now()
    };
    await put('foodMaster', foodData);
    if (onSaved) onSaved();
    else {
      host.closest('.card').querySelectorAll('input,select').forEach(i => i.value = '');
      alert('保存しました');
    }
  });
}

// ===== レシピ（複数の餌を混ぜる場合のみ登録） =====
async function renderRecipeMaster(content) {
  const recipes = await getAll('recipeMaster');
  const foods = await getAll('foodMaster');
  const forms = (await getByIndex('codeMaster', 'byCategory', FOOD_FORM_CATEGORY)).filter(f => f.code !== '');
  const types = (await getByIndex('codeMaster', 'byCategory', FOOD_TYPE_CATEGORY)).filter(t => t.code !== '');
  const makers = (await getByIndex('codeMaster', 'byCategory', MAKER_CATEGORY)).filter(m => m.code !== '');

  function componentsLabel(components) {
    return (components || []).map(c => {
      const f = foods.find(x => x.code === c.foodCode);
      return `${f ? f.name : c.foodCode}:${c.ratio}`;
    }).join(' / ');
  }

  let html = `<div class="panel"><div class="panel-header"><h3>レシピ</h3><button id="recipeNewBtn" class="btn-small">${showNewRecipeForm ? '－閉じる' : '＋新規作成'}</button></div>
    <p class="muted">複数の餌を混ぜて与える場合だけここに登録します。単一の餌はそのまま給餌管理画面から選べます。</p>`;
  if (showNewRecipeForm) html += `<div class="card"><div class="card-title">新規レシピを追加</div><div id="recipeForm"></div></div>`;
  html += `<div class="feed-filter">
      <select id="recipeMasterFilterDisplay"><option value="">表示/非表示(すべて)</option><option value="visible">表示のみ</option><option value="hidden">非表示のみ</option></select>
    </div>
    <div id="recipeListHost"></div>`;
  html += `</div>`;
  content.innerHTML = html;

  content.querySelector('#recipeNewBtn').addEventListener('click', () => {
    showNewRecipeForm = !showNewRecipeForm;
    renderRecipeMaster(content);
  });

  const listHost = content.querySelector('#recipeListHost');
  const filterDisplay = content.querySelector('#recipeMasterFilterDisplay');

  function renderList() {
    const filtered = recipes.filter(r => {
      const visible = r.display !== false;
      if (filterDisplay.value === 'visible' && !visible) return false;
      if (filterDisplay.value === 'hidden' && visible) return false;
      return true;
    });
    let listHtml = '';
    filtered.forEach(r => {
      const visible = r.display !== false;
      const isOpen = expandedRecipeCode === r.code;
      listHtml += `<div class="card accordion-card ${visible ? '' : 'hidden-item'}">
        <div class="accordion-header">
          <button class="accordion-name-btn" data-toggle-recipe="${escapeHtml(r.code)}">${escapeHtml(r.name)}${visible ? '' : '<span class="hidden-badge">非表示</span>'}</button>
          <div class="accordion-header-actions">
            <button class="btn-tiny icon-btn eye-btn ${visible ? '' : 'eye-off'}" data-toggle-display-recipe="${escapeHtml(r.code)}" title="${visible ? '非表示にする' : '表示に戻す'}">${visible ? '👓' : '🕶️'}</button>
            <span class="accordion-arrow">${isOpen ? '▼' : '▶'}</span>
          </div>
        </div>
        ${isOpen ? `<div class="accordion-body">
          <div class="kv">コード: ${escapeHtml(r.code)}</div>
          <div class="kv">略称: ${escapeHtml(r.abbr || '-')}</div>
          <div class="kv">配合: ${escapeHtml(componentsLabel(r.components)) || '-'}</div>
          <div class="kv">給仕デフォルト量: ${r.defaultAmountG ? escapeHtml(r.defaultAmountG) + ' g' : '-'}</div>
          <div class="kv">メモ: ${escapeHtml(r.memo || '-')}</div>
          <div class="actions">
            <button class="btn-small icon-btn" data-edit-recipe="${escapeHtml(r.code)}" title="編集">✏️</button>
            <button class="btn-small icon-btn danger" data-del-recipe="${escapeHtml(r.code)}" title="削除">🗑️</button>
          </div>
        </div>` : ''}
      </div>`;
    });
    listHost.innerHTML = listHtml || '<div class="muted">該当するレシピがありません</div>';

    listHost.querySelectorAll('[data-toggle-recipe]').forEach(btn => btn.addEventListener('click', () => {
      const code = btn.dataset.toggleRecipe;
      expandedRecipeCode = expandedRecipeCode === code ? null : code;
      renderList();
    }));

    listHost.querySelectorAll('[data-toggle-display-recipe]').forEach(btn => btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const code = btn.dataset.toggleDisplayRecipe;
      const r = recipes.find(x => x.code === code);
      if (!r) return;
      r.display = r.display === false ? true : false;
      await put('recipeMaster', r);
      renderList();
    }));

    listHost.querySelectorAll('[data-edit-recipe]').forEach(btn => btn.addEventListener('click', async () => {
      const code = btn.dataset.editRecipe;
      const r = await get('recipeMaster', code);
      const formHost = el(`<div class="card"><div class="card-title">編集: ${escapeHtml(r.name)}</div><div></div></div>`);
      btn.closest('.card').replaceWith(formHost);
      renderRecipeForm(formHost.querySelector('div:last-child'), r, foods, makers, forms, types, () => renderRecipeMaster(content), () => renderRecipeMaster(content));
    }));

    listHost.querySelectorAll('[data-del-recipe]').forEach(btn => btn.addEventListener('click', async () => {
      const code = btn.dataset.delRecipe;
      const feeding = await getAll('feedingLog');
      const used = feeding.some(x => x.sourceType === 'RECIPE' && x.sourceCode === code);
      if (used) { alert('このレシピは使用中のため削除できません'); return; }
      if (!confirm('削除しますか？')) return;
      await remove('recipeMaster', code);
      renderRecipeMaster(content);
    }));
  }

  filterDisplay.addEventListener('change', renderList);
  renderList();

  if (showNewRecipeForm) {
    renderRecipeForm(content.querySelector('#recipeForm'), null, foods, makers, forms, types, () => { showNewRecipeForm = false; renderRecipeMaster(content); }, () => { showNewRecipeForm = false; renderRecipeMaster(content); });
  }
}

// 餌選択UI: 餌マスタと同じ検索/フィルタで絞り込み→プルダウンで1件選択→比率入力→「追加」でリストへ。
// 追加済みリストの各行は比率をその場で編集可能、削除ボタンで取り除ける。
function renderRecipeForm(host, existing, foods, makers, forms, types, onSaved, onCancel) {
  const isEdit = !!existing;
  // 構成餌の入力行（メモリ上で保持し、保存時にまとめて書き込む）。
  // レシピは最低2種類必要なので、新規時は最初から2行用意しておく。
  const slots = isEdit && (existing.components || []).length
    ? (existing.components || []).map(c => ({ foodCode: c.foodCode, ratio: c.ratio }))
    : [{ foodCode: '', ratio: '' }, { foodCode: '', ratio: '' }];

  // スロットごとに検索語・フィルタも保持する（入力する餌の数だけ検索欄が要るため）
  slots.forEach(s => {
    if (s.search === undefined) s.search = '';
    if (s.filterMaker === undefined) s.filterMaker = '';
    if (s.filterForm === undefined) s.filterForm = '';
    if (s.filterType === undefined) s.filterType = '';
  });

  function buildOptionsHtml(list, selectedVal) {
    return (list || []).map(o => `<option value="${escapeHtml(o.code)}" ${o.code === selectedVal ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('');
  }

  host.innerHTML = `
    <div class="field"><label>コード</label><input id="rc_code" class="required-input" ${isEdit ? 'disabled' : ''} value="${isEdit ? escapeHtml(existing.code) : ''}"></div>
    <div class="field"><label>名称</label><input id="rc_name" class="required-input" value="${isEdit ? escapeHtml(existing.name) : ''}"></div>
    <div class="field"><label>略称（ログ表示用）</label><input id="rc_abbr" value="${isEdit ? escapeHtml(existing.abbr || '') : ''}"></div>
    <div class="field"><label>配合する餌と比率（2種類以上）</label>
      <div id="rc_slots_host"></div>
      <button id="rc_add_slot" type="button" class="btn-small">＋行を追加</button>
    </div>
    <div class="field"><label>給仕デフォルト量(g)</label><input id="rc_default" type="number" step="0.1" value="${isEdit && existing.defaultAmountG ? existing.defaultAmountG : ''}"></div>
    <div class="field"><label>メモ</label><input id="rc_memo" value="${isEdit ? escapeHtml(existing.memo || '') : ''}"></div>
    <div class="form-actions">
      <button id="rc_save" class="btn-primary">${isEdit ? '更新' : '追加'}</button>
      <button id="rc_cancel" class="btn-small">キャンセル</button>
    </div>
  `;

  if (onCancel) host.querySelector('#rc_cancel').addEventListener('click', onCancel);

  const slotsHost = host.querySelector('#rc_slots_host');

  // 検索/フィルタで絞り込んだ候補（他の行で選択済みの餌は除外。自分自身の選択は含める）
  function getCandidates(idx) {
    const s = slots[idx];
    const q = (s.search || '').trim().toLowerCase();
    const chosenElsewhere = new Set(slots.filter((s2, i) => i !== idx && s2.foodCode).map(s2 => s2.foodCode));
    return foods.filter(f => {
      if (chosenElsewhere.has(f.code)) return false;
      if (s.filterMaker && f.makerCode !== s.filterMaker) return false;
      if (s.filterForm && f.formCode !== s.filterForm) return false;
      if (s.filterType && f.typeCode !== s.filterType) return false;
      if (q && !(f.name || '').toLowerCase().includes(q) && !(f.abbr || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function renderSlots() {
    // 検索ボックスはスロット内に移動したため、入力中に全体を再描画するとフォーカスが外れてしまう。
    // 再描画前にフォーカス位置とカーソル位置を記録し、再描画後に復元する。
    const active = document.activeElement;
    let restoreIdx = null;
    let restoreCursor = null;
    if (active && slotsHost.contains(active) && active.classList.contains('rc_slot_search')) {
      restoreIdx = active.dataset.idx;
      restoreCursor = active.selectionStart;
    }
    const rowsHtml = slots.map((s, idx) => {
      const candidates = getCandidates(idx);
      const optionsHtml = candidates.map(f => `<option value="${escapeHtml(f.code)}" ${f.code === s.foodCode ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('');
      return `<div class="rc_slot_block">
        ${idx > 0 ? '<hr class="rc_slot_divider">' : ''}
        <div class="feed-filter">
          <input type="text" class="rc_slot_search" data-idx="${idx}" placeholder="餌名・略称で検索" value="${escapeHtml(s.search)}">
          <select class="rc_slot_filter_maker" data-idx="${idx}"><option value="">メーカー(すべて)</option>${buildOptionsHtml(makers, s.filterMaker)}</select>
          <select class="rc_slot_filter_form" data-idx="${idx}"><option value="">形態(すべて)</option>${buildOptionsHtml(forms, s.filterForm)}</select>
          <select class="rc_slot_filter_type" data-idx="${idx}"><option value="">種類(すべて)</option>${buildOptionsHtml(types, s.filterType)}</select>
        </div>
        <div class="field" style="flex-direction:row; align-items:center; gap:8px;">
          <select class="rc_slot_select" data-idx="${idx}" style="flex:1;">
            <option value="">（未選択）</option>
            ${optionsHtml}
          </select>
          <input type="number" step="0.1" class="rc_slot_ratio" data-idx="${idx}" placeholder="比率" style="width:80px;" value="${escapeHtml(s.ratio)}">
        </div>
        ${slots.length > 2 ? `<div class="rc_slot_del_row"><button type="button" class="btn-tiny icon-btn danger rc_slot_del" data-idx="${idx}" title="削除">🗑️ この行を削除</button></div>` : ''}
      </div>`;
    }).join('');
    slotsHost.innerHTML = rowsHtml;

    slotsHost.querySelectorAll('.rc_slot_search').forEach(inp => inp.addEventListener('input', () => {
      slots[Number(inp.dataset.idx)].search = inp.value;
      renderSlots();
    }));
    slotsHost.querySelectorAll('.rc_slot_filter_maker').forEach(sel => sel.addEventListener('change', () => {
      slots[Number(sel.dataset.idx)].filterMaker = sel.value;
      renderSlots();
    }));
    slotsHost.querySelectorAll('.rc_slot_filter_form').forEach(sel => sel.addEventListener('change', () => {
      slots[Number(sel.dataset.idx)].filterForm = sel.value;
      renderSlots();
    }));
    slotsHost.querySelectorAll('.rc_slot_filter_type').forEach(sel => sel.addEventListener('change', () => {
      slots[Number(sel.dataset.idx)].filterType = sel.value;
      renderSlots();
    }));
    slotsHost.querySelectorAll('.rc_slot_select').forEach(sel => sel.addEventListener('change', () => {
      slots[Number(sel.dataset.idx)].foodCode = sel.value;
      renderSlots();
    }));
    slotsHost.querySelectorAll('.rc_slot_ratio').forEach(inp => inp.addEventListener('change', () => {
      slots[Number(inp.dataset.idx)].ratio = inp.value;
    }));

    if (restoreIdx !== null) {
      const toFocus = slotsHost.querySelector(`.rc_slot_search[data-idx="${restoreIdx}"]`);
      if (toFocus) {
        toFocus.focus();
        if (restoreCursor != null) toFocus.setSelectionRange(restoreCursor, restoreCursor);
      }
    }
    slotsHost.querySelectorAll('.rc_slot_del').forEach(btn => btn.addEventListener('click', () => {
      slots.splice(Number(btn.dataset.idx), 1);
      renderSlots();
    }));
  }

  host.querySelector('#rc_add_slot').addEventListener('click', () => {
    slots.push({ foodCode: '', ratio: '', search: '', filterMaker: '', filterForm: '', filterType: '' });
    renderSlots();
  });

  renderSlots();

  host.querySelector('#rc_save').addEventListener('click', async () => {
    const code = host.querySelector('#rc_code').value.trim();
    const name = host.querySelector('#rc_name').value.trim();
    if (!code || !name) { alert('コードと名称は必須です'); return; }
    if (!isEdit) {
      const existingR = await get('recipeMaster', code);
      if (existingR) { alert('既に存在するコードです'); return; }
    }
    const components = slots
      .filter(s => s.foodCode)
      .map(s => ({ foodCode: s.foodCode, ratio: Number(s.ratio) || 1 }));
    if (components.length < 2) { alert('レシピは2種類以上の餌を選んでください（単一の餌は登録不要です）'); return; }
    const data = { code, name, abbr: host.querySelector('#rc_abbr').value.trim(), components, defaultAmountG: Number(host.querySelector('#rc_default').value) || 0, memo: host.querySelector('#rc_memo').value, seq: isEdit ? existing.seq : Date.now() };
    await put('recipeMaster', data);
    if (onSaved) onSaved();
    else {
      alert('保存しました');
    }
  });
}

// ===== 薬・サプリマスタ =====
async function renderMedicineMaster(content) {
  const medicines = await getAll('medicineMaster');
  const units = (await getByIndex('codeMaster', 'byCategory', MED_UNIT_CATEGORY)).filter(u => u.code !== '');
  const effects = (await getByIndex('codeMaster', 'byCategory', MED_EFFECT_CATEGORY)).filter(e => e.code !== '');

  let html = `<div class="panel">
    <div class="panel-header"><h3>薬・サプリマスタ</h3><button id="medicineNewBtn" class="btn-small">${showNewMedicineForm ? '－閉じる' : '＋新規作成'}</button></div>
    ${showNewMedicineForm ? '<div class="card"><div class="card-title">新規登録</div><div id="medicineForm"></div></div>' : ''}
    <div class="feed-filter">
      <select id="medicineMasterFilterDisplay"><option value="">表示/非表示(すべて)</option><option value="visible">表示のみ</option><option value="hidden">非表示のみ</option></select>
    </div>
    <div id="medicineListHost"></div>
  </div>`;
  content.innerHTML = html;

  content.querySelector('#medicineNewBtn').addEventListener('click', () => {
    showNewMedicineForm = !showNewMedicineForm;
    renderMedicineMaster(content);
  });

  const listHost = content.querySelector('#medicineListHost');
  const filterDisplay = content.querySelector('#medicineMasterFilterDisplay');

  function renderList() {
    const filtered = medicines.filter(m => {
      const visible = m.display !== false;
      if (filterDisplay.value === 'visible' && !visible) return false;
      if (filterDisplay.value === 'hidden' && visible) return false;
      return true;
    });
    let listHtml = '';
    filtered.forEach(m => {
      const unitName = units.find(u => u.code === m.unitCode);
      const effectName = effects.find(e => e.code === m.effectCode);
      const kindLabel = m.kindFlag === 'SUPPLEMENT' ? 'サプリ' : '薬';
      const visible = m.display !== false;
      const isOpen = expandedMedicineCode === m.code;
      listHtml += `<div class="card accordion-card ${visible ? '' : 'hidden-item'}">
        <div class="accordion-header">
          <button class="accordion-name-btn" data-toggle-medicine="${escapeHtml(m.code)}">${escapeHtml(m.name)}${visible ? '' : '<span class="hidden-badge">非表示</span>'}</button>
          <div class="accordion-header-actions">
            <button class="btn-tiny icon-btn eye-btn ${visible ? '' : 'eye-off'}" data-toggle-display-medicine="${escapeHtml(m.code)}" title="${visible ? '非表示にする' : '表示に戻す'}">${visible ? '👓' : '🕶️'}</button>
            <span class="accordion-arrow">${isOpen ? '▼' : '▶'}</span>
          </div>
        </div>
        ${isOpen ? `<div class="accordion-body">
          <div class="kv">コード: ${escapeHtml(m.code)}（${escapeHtml(kindLabel)}）</div>
          <div class="kv">略称: ${escapeHtml(m.abbr || '-')}</div>
          <div class="kv">デフォルト用量: ${m.defaultDose != null && m.defaultDose !== '' ? escapeHtml(m.defaultDose) + escapeHtml(unitName ? unitName.name : '') : '-'}</div>
          <div class="kv">効能: ${escapeHtml(effectName ? effectName.name : '-')}</div>
          <div class="kv">メモ: ${escapeHtml(m.memo || '-')}</div>
          <div class="actions">
            <button class="btn-small icon-btn" data-edit-medicine="${escapeHtml(m.code)}" title="編集">✏️</button>
            <button class="btn-small icon-btn danger" data-del-medicine="${escapeHtml(m.code)}" title="削除">🗑️</button>
          </div>
        </div>` : ''}
      </div>`;
    });
    listHost.innerHTML = listHtml || '<div class="muted">該当するサプリ・薬がありません</div>';

    listHost.querySelectorAll('[data-toggle-medicine]').forEach(btn => btn.addEventListener('click', () => {
      const code = btn.dataset.toggleMedicine;
      expandedMedicineCode = expandedMedicineCode === code ? null : code;
      renderList();
    }));

    listHost.querySelectorAll('[data-toggle-display-medicine]').forEach(btn => btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const code = btn.dataset.toggleDisplayMedicine;
      const m = medicines.find(x => x.code === code);
      if (!m) return;
      m.display = m.display === false ? true : false;
      await put('medicineMaster', m);
      renderList();
    }));

    listHost.querySelectorAll('[data-edit-medicine]').forEach(btn => btn.addEventListener('click', async () => {
      const code = btn.dataset.editMedicine;
      const m = await get('medicineMaster', code);
      const formHost = el(`<div class="card"><div class="card-title">編集: ${escapeHtml(m.name)}</div><div></div></div>`);
      btn.closest('.card').replaceWith(formHost);
      renderMedicineForm(formHost.querySelector('div:last-child'), m, units, effects, () => renderMedicineMaster(content), () => renderMedicineMaster(content));
    }));

    listHost.querySelectorAll('[data-del-medicine]').forEach(btn => btn.addEventListener('click', async () => {
      const code = btn.dataset.delMedicine;
      const logs = await getAll('medicineLog');
      const used = logs.some(l => l.medicineCode === code);
      if (used) { alert('このサプリ・薬は使用中のため削除できません'); return; }
      if (!confirm('削除しますか？')) return;
      await remove('medicineMaster', code);
      renderMedicineMaster(content);
    }));
  }

  filterDisplay.addEventListener('change', renderList);
  renderList();

  if (showNewMedicineForm) {
    renderMedicineForm(content.querySelector('#medicineForm'), null, units, effects, () => { showNewMedicineForm = false; renderMedicineMaster(content); }, () => { showNewMedicineForm = false; renderMedicineMaster(content); });
  }
}

function renderMedicineForm(host, existing, units, effects, onSaved, onCancel) {
  const isEdit = !!existing;
  const unitOptions = units.map(u => `<option value="${escapeHtml(u.code)}" ${isEdit && existing.unitCode === u.code ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('');
  const effectOptions = effects.map(e => `<option value="${escapeHtml(e.code)}" ${isEdit && existing.effectCode === e.code ? 'selected' : ''}>${escapeHtml(e.name)}</option>`).join('');
  host.innerHTML = `
    <div class="field"><label>コード</label><input id="mm_code" class="required-input" ${isEdit ? 'disabled' : ''} value="${isEdit ? escapeHtml(existing.code) : ''}"></div>
    <div class="field"><label>名称</label><input id="mm_name" class="required-input" value="${isEdit ? escapeHtml(existing.name) : ''}"></div>
    <div class="field"><label>略称（ログ表示用）</label><input id="mm_abbr" value="${isEdit ? escapeHtml(existing.abbr || '') : ''}"></div>
    <div class="field"><label>区分</label>
      <select id="mm_kind">
        <option value="DRUG" ${!isEdit || existing.kindFlag !== 'SUPPLEMENT' ? 'selected' : ''}>薬</option>
        <option value="SUPPLEMENT" ${isEdit && existing.kindFlag === 'SUPPLEMENT' ? 'selected' : ''}>サプリ</option>
      </select>
    </div>
    <div class="field"><label>デフォルト用量</label><input id="mm_dose" type="number" step="0.01" value="${isEdit && existing.defaultDose != null ? existing.defaultDose : ''}"></div>
    <div class="field"><label>単位</label><select id="mm_unit"><option value="">未選択</option>${unitOptions}</select></div>
    <div class="field"><label>効能</label><select id="mm_effect"><option value="">未選択</option>${effectOptions}</select></div>
    <div class="field"><label>メモ</label><input id="mm_memo" value="${isEdit ? escapeHtml(existing.memo || '') : ''}"></div>
    <div class="form-actions">
      <button id="mm_save" class="btn-primary">${isEdit ? '更新' : '追加'}</button>
      <button id="mm_cancel" class="btn-small">キャンセル</button>
    </div>
  `;
  if (onCancel) host.querySelector('#mm_cancel').addEventListener('click', onCancel);
  host.querySelector('#mm_save').addEventListener('click', async () => {
    const code = host.querySelector('#mm_code').value.trim();
    const name = host.querySelector('#mm_name').value.trim();
    if (!code || !name) { alert('コードと名称は必須です'); return; }
    if (!isEdit) {
      const existingM = await get('medicineMaster', code);
      if (existingM) { alert('既に存在するコードです'); return; }
    }
    const doseVal = host.querySelector('#mm_dose').value;
    const data = {
      code,
      name,
      abbr: host.querySelector('#mm_abbr').value.trim(),
      kindFlag: host.querySelector('#mm_kind').value,
      defaultDose: doseVal === '' ? null : Number(doseVal),
      unitCode: host.querySelector('#mm_unit').value,
      effectCode: host.querySelector('#mm_effect').value,
      memo: host.querySelector('#mm_memo').value,
      seq: isEdit ? existing.seq : Date.now()
    };
    await put('medicineMaster', data);
    if (onSaved) onSaved();
    else {
      host.closest('.card').querySelectorAll('input,select').forEach(i => i.value = '');
      alert('保存しました');
    }
  });
}

// ===== データ入出力 =====
const STORE_LABELS = {
  codeMaster: 'コードマスタ',
  catMaster: '猫マスタ',
  foodMaster: '餌マスタ',
  recipeMaster: 'レシピマスタ',
  medicineMaster: '薬・サプリマスタ',
  dailyLog: '日々ログ（体重・尿量など）',
  feedingLog: '給餌ログ',
  medicineLog: '投薬ログ',
  excretionLog: 'うんち・ゲロログ',
  memoLog: 'メモログ',
};

async function renderIO(content, callbacks) {
  const storeChecksHtml = STORES.map(s => `<label class="chk"><input type="checkbox" class="export-store-chk" value="${s}" checked> ${escapeHtml(STORE_LABELS[s] || s)}</label>`).join('');
  content.innerHTML = `
    <div class="panel">
      <div class="card">
        <div class="card-title">エクスポート</div>
        <p class="muted">選択した内容をまとめてZIPファイルとして書き出します（日々のバックアップ用）。</p>
        <div class="chk-list">${storeChecksHtml}</div>
        <div class="actions">
          <button id="exportSelectAll" class="btn-tiny">すべて選択</button>
          <button id="exportSelectNone" class="btn-tiny">選択解除</button>
        </div>
        <button id="exportBtn" class="btn-primary">ZIPでエクスポート</button>
      </div>
      <div class="card">
        <div class="card-title">インポート</div>
        <p class="muted">エクスポートしたZIP（またはJSON）ファイルを読み込みます。ファイルに含まれるデータのみ上書きされます。</p>
        <input type="file" id="importFile" accept="application/zip,application/json,.zip,.json">
        <button id="importBtn" class="btn-primary">インポート</button>
      </div>
      <div class="card">
        <div class="card-title">猫別 日々データ取込</div>
        <p class="muted">import/devico.json のような、猫1匹分の日々の記録（給餌・投薬・うんち/ゲロ・メモ・体重など）をまとめたJSONを取り込みます。対象の猫×日付の範囲だけを作り直すので、他の猫・他の日・マスタには影響しません。何度取り込み直しても重複しません。フォーマットは import/FORMAT.md を参照してください。</p>
        <input type="file" id="dayImportFile" accept="application/json">
        <button id="dayImportBtn" class="btn-primary">取込</button>
      </div>
      <div class="card">
        <div class="card-title">データコンバート</div>
        <p class="muted">js/initial-data.js との差分マージ、旧データの補正、カロリーキャッシュの再集計などをまとめて実行します。既存データは削除されません。何度実行しても安全です（アプリ更新後やinitial-data.js編集後に押してください）。</p>
        <button id="convertBtn" class="btn-primary">データコンバート実行</button>
      </div>
      <div class="card">
        <div class="card-title">初期化</div>
        <p class="muted">保存されているデータをすべて削除し、js/initial-data.js の内容だけを反映し直します。元に戻せません。</p>
        <button id="resetBtn" class="btn-small danger">初期化する</button>
      </div>
    </div>
  `;
  const { exportSelected, importAll } = await import('./io.js');
  const { importCatDayLogFile } = await import('./dayImport.js');
  const storeChks = content.querySelectorAll('.export-store-chk');
  content.querySelector('#exportSelectAll').addEventListener('click', () => {
    storeChks.forEach(c => { c.checked = true; });
  });
  content.querySelector('#exportSelectNone').addEventListener('click', () => {
    storeChks.forEach(c => { c.checked = false; });
  });
  content.querySelector('#exportBtn').addEventListener('click', async () => {
    const selected = Array.from(storeChks).filter(c => c.checked).map(c => c.value);
    if (!selected.length) { alert('エクスポートする項目を選択してください'); return; }
    await exportSelected(selected);
  });
  content.querySelector('#importBtn').addEventListener('click', async () => {
    const fileInput = content.querySelector('#importFile');
    if (!fileInput.files[0]) { alert('ファイルを選択してください'); return; }
    if (!confirm('既存データを上書きします。よろしいですか？')) return;
    await importAll(fileInput.files[0]);
    if (callbacks && callbacks.onCatsChanged) callbacks.onCatsChanged();
    alert('インポートしました');
  });
  content.querySelector('#dayImportBtn').addEventListener('click', async () => {
    const fileInput = content.querySelector('#dayImportFile');
    if (!fileInput.files[0]) { alert('ファイルを選択してください'); return; }
    try {
      const result = await importCatDayLogFile(fileInput.files[0]);
      if (callbacks && callbacks.onCatsChanged) callbacks.onCatsChanged();
      let msg = `${result.catCode}: ${result.dates}日分を取り込みました\n給餌${result.feeding}件 / 投薬${result.medicine}件 / うんち${result.poop}件 / ゲロ${result.vomit}件 / メモ${result.memos}件`;
      if (result.errors.length) msg += `\n\n警告:\n${result.errors.join('\n')}`;
      alert(msg);
    } catch (err) {
      alert('取込に失敗しました: ' + err.message);
    }
  });
  content.querySelector('#convertBtn').addEventListener('click', async () => {
    const btn = content.querySelector('#convertBtn');
    btn.disabled = true;
    btn.textContent = '実行中…';
    try {
      const r = await seedDefaults();
      if (callbacks && callbacks.onCatsChanged) callbacks.onCatsChanged();
      const addedTotal = r.codeAdded + r.catAdded + r.foodAdded + r.medicineAdded + r.recipeAdded;
      const msg = `データコンバートが完了しました\n\n`
        + `マスタ追加: ${addedTotal}件（コード${r.codeAdded} / 猫${r.catAdded} / 餌${r.foodAdded} / 薬・サプリ${r.medicineAdded} / レシピ${r.recipeAdded}）\n`
        + `薬・サプリのkindFlag補正: ${r.kindFlagFixed}件\n`
        + `登録順(seq)補正: ${r.seqFixed}件\n`
        + `カロリーキャッシュ更新: ${r.kcalUpdated}件`;
      alert(msg);
    } catch (err) {
      alert('データコンバートに失敗しました: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'データコンバート実行';
    }
  });
  content.querySelector('#resetBtn').addEventListener('click', async () => {
    if (!confirm('すべてのデータを削除し、js/initial-data.js の内容で初期化します。よろしいですか？（元に戻せません）')) return;
    for (const store of STORES) {
      await clearStore(store);
    }
    await seedDefaults();
    alert('初期化しました。');
    location.reload();
  });
}

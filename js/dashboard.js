import { getAll, get, put, remove, getByIndex, clearStore, STORES } from './db.js';
import { escapeHtml, el } from './utils.js';
import { initialCodeMaster, initialCatMaster, initialFoodMaster, initialMedicineMaster, initialRecipeMaster } from './initial-data.js';

export const FOOD_FORM_CATEGORY = 'FOOD_FORM';
export const FOOD_TYPE_CATEGORY = 'FOOD_TYPE';
export const MAKER_CATEGORY = 'MAKER';
export const STOOL_STATE_CATEGORY = 'STOOL_STATE';
export const VOMIT_STATE_CATEGORY = 'VOMIT_STATE';
export const MED_UNIT_CATEGORY = 'MED_UNIT';
export const MED_EFFECT_CATEGORY = 'MED_EFFECT';

// 初回起動時／アップデート時のマスタ種seed
// js/initial-data.js の内容のうち、「まだ登録されていないもの」だけを追加する。
// 既にアプリ内で編集・削除したデータは上書きしない。
export async function seedDefaults() {
  await ensureCodeMaster(initialCodeMaster);
  await ensureCatMaster(initialCatMaster);
  await ensureFoodMaster(initialFoodMaster);
  await ensureMedicineMaster(initialMedicineMaster);
  await ensureRecipeMaster(initialRecipeMaster);
}

async function ensureCodeMaster(entries) {
  const existing = await getAll('codeMaster');
  const existingKeys = new Set(existing.map(r => `${r.category}::${r.code}`));
  for (const e of entries) {
    if (!existingKeys.has(`${e.category}::${e.code}`)) {
      await put('codeMaster', { category: e.category, code: e.code, name: e.name });
    }
  }
}

async function ensureCatMaster(entries) {
  for (const e of entries) {
    const existing = await get('catMaster', e.code);
    if (!existing) await put('catMaster', { ...e });
  }
}

async function ensureFoodMaster(entries) {
  for (const e of entries) {
    const existing = await get('foodMaster', e.code);
    if (!existing) await put('foodMaster', { ...e });
  }
}

async function ensureMedicineMaster(entries) {
  for (const e of entries) {
    const existing = await get('medicineMaster', e.code);
    if (!existing) await put('medicineMaster', { ...e });
  }
}

async function ensureRecipeMaster(entries) {
  for (const e of entries) {
    const existing = await get('recipeMaster', e.code);
    if (!existing) await put('recipeMaster', { ...e });
  }
}

export async function renderDashboard(container, callbacks) {
  container.innerHTML = `
    <div class="subtabs">
      <button data-sub="code" class="subtab active">コードマスタ</button>
      <button data-sub="cat" class="subtab">猫マスタ</button>
      <button data-sub="food" class="subtab">餌マスタ</button>
      <button data-sub="recipe" class="subtab">レシピ</button>
      <button data-sub="medicine" class="subtab">薬・サプリマスタ</button>
      <button data-sub="io" class="subtab">データ入出力</button>
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
  await showSub('code');
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

  Object.keys(categories).sort().forEach(cat => {
    const c = categories[cat];
    const headerName = c.header ? c.header.name : cat;
    html += `<div class="card">
      <div class="card-title">
        ${escapeHtml(headerName)} <span class="muted">(${escapeHtml(cat)})</span>
        <button class="btn-tiny danger" data-del-header="${escapeHtml(cat)}">大分類削除</button>
      </div>
      <table class="tbl"><tbody>`;
    c.items.forEach(item => {
      html += `<tr>
        <td>${escapeHtml(item.code)}</td>
        <td>${escapeHtml(item.name)}</td>
        <td class="actions">
          <button class="btn-tiny" data-edit-code="${item.id}">編集</button>
          <button class="btn-tiny danger" data-del-code="${item.id}">削除</button>
        </td>
      </tr>`;
    });
    html += `</tbody></table>
      <button class="btn-small" data-add-code="${escapeHtml(cat)}">＋コード追加</button>
    </div>`;
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
    renderCodeMaster(content);
  });

  content.querySelectorAll('[data-add-code]').forEach(btn => btn.addEventListener('click', async () => {
    const cat = btn.dataset.addCode;
    const code = prompt('コードを入力してください');
    if (!code) return;
    const exists = categories[cat].items.some(i => i.code === code);
    if (exists) { alert('既に存在するコードです'); return; }
    const name = prompt('名称を入力してください');
    if (!name) return;
    await put('codeMaster', { category: cat, code, name });
    renderCodeMaster(content);
  }));

  content.querySelectorAll('[data-edit-code]').forEach(btn => btn.addEventListener('click', async () => {
    const id = Number(btn.dataset.editCode);
    const row = await get('codeMaster', id);
    const name = prompt('名称を編集', row.name);
    if (!name) return;
    row.name = name;
    await put('codeMaster', row);
    renderCodeMaster(content);
  }));

  content.querySelectorAll('[data-del-code]').forEach(btn => btn.addEventListener('click', async () => {
    const id = Number(btn.dataset.delCode);
    const row = await get('codeMaster', id);
    const foods = await getAll('foodMaster');
    const usedInFood = foods.some(f => f.formCode === row.code || f.typeCode === row.code || f.makerCode === row.code);
    const excretions = await getAll('excretionLog');
    const usedInExcretion = excretions.some(e => e.stateCode === row.code);
    const medicines = await getAll('medicineMaster');
    const usedInMedicine = medicines.some(m => m.unitCode === row.code || m.effectCode === row.code);
    if (usedInFood || usedInExcretion || usedInMedicine) { alert('この項目は既存データで使用されているため削除できません'); return; }
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
    renderCodeMaster(content);
  }));
}

// ===== 猫マスタ =====
async function renderCatMaster(content, callbacks) {
  const cats = await getAll('catMaster');
  const foods = await getAll('foodMaster');

  let html = `<div class="panel">
    <div class="panel-header"><h3>猫マスタ</h3></div>`;
  cats.forEach(cat => {
    html += `<div class="card">
      <div class="card-title">${escapeHtml(cat.name)} <span class="muted">(${escapeHtml(cat.code)})</span></div>
      <div class="kv">生年月日: ${escapeHtml(cat.birthDate || '-')}</div>
      <div class="kv">性別: ${escapeHtml(cat.sex || '-')}</div>
      <div class="kv">餌候補: ${(cat.foodCandidates || []).map(fc => {
        const f = foods.find(x => x.code === fc);
        return escapeHtml(f ? f.name : fc);
      }).join('、') || '-'}</div>
      <div class="kv">メモ: ${escapeHtml(cat.memo || '-')}</div>
      <div class="actions">
        <button class="btn-small" data-edit-cat="${escapeHtml(cat.code)}">編集</button>
        <button class="btn-small danger" data-del-cat="${escapeHtml(cat.code)}">削除</button>
      </div>
    </div>`;
  });
  html += `<div class="card">
    <div class="card-title">新規猫を追加</div>
    <div id="catForm"></div>
  </div></div>`;
  content.innerHTML = html;

  renderCatForm(content.querySelector('#catForm'), null, foods, callbacks, () => renderCatMaster(content, callbacks));

  content.querySelectorAll('[data-edit-cat]').forEach(btn => btn.addEventListener('click', async () => {
    const code = btn.dataset.editCat;
    const cat = await get('catMaster', code);
    const formHost = el(`<div class="card"><div class="card-title">猫編集: ${escapeHtml(cat.name)}</div><div></div></div>`);
    btn.closest('.card').replaceWith(formHost);
    renderCatForm(formHost.querySelector('div:last-child'), cat, foods, callbacks, () => renderCatMaster(content, callbacks));
  }));

  content.querySelectorAll('[data-del-cat]').forEach(btn => btn.addEventListener('click', async () => {
    const code = btn.dataset.delCat;
    const daily = await getByIndex('dailyLog', 'byCat', code);
    const feeding = await getByIndex('feedingLog', 'byCat', code);
    const medicine = await getByIndex('medicineLog', 'byCat', code);
    const excretion = await getByIndex('excretionLog', 'byCat', code);
    if (daily.length > 0 || feeding.length > 0 || medicine.length > 0 || excretion.length > 0) {
      alert('この猫には入力済みのデータがあるため削除できません');
      return;
    }
    if (!confirm('この猫を削除しますか？')) return;
    await remove('catMaster', code);
    if (callbacks && callbacks.onCatsChanged) callbacks.onCatsChanged();
    renderCatMaster(content, callbacks);
  }));
}

function renderCatForm(host, existing, foods, callbacks, onSaved) {
  const isEdit = !!existing;
  const foodOptions = foods.map(f => {
    const checked = existing && existing.foodCandidates && existing.foodCandidates.includes(f.code) ? 'checked' : '';
    return `<label class="chk"><input type="checkbox" value="${escapeHtml(f.code)}" ${checked}> ${escapeHtml(f.name)}</label>`;
  }).join('');

  host.innerHTML = `
    <div class="field"><label>コード</label><input id="f_code" ${isEdit ? 'disabled' : ''} value="${isEdit ? escapeHtml(existing.code) : ''}"></div>
    <div class="field"><label>名前</label><input id="f_name" value="${isEdit ? escapeHtml(existing.name) : ''}"></div>
    <div class="field"><label>生年月日</label><input id="f_birth" type="date" value="${isEdit ? escapeHtml(existing.birthDate || '') : ''}"></div>
    <div class="field"><label>性別</label>
      <select id="f_sex">
        <option value="">未設定</option>
        <option value="オス" ${isEdit && existing.sex === 'オス' ? 'selected' : ''}>オス</option>
        <option value="メス" ${isEdit && existing.sex === 'メス' ? 'selected' : ''}>メス</option>
      </select>
    </div>
    <div class="field"><label>餌候補</label><div class="chk-list">${foodOptions || '<span class="muted">餌マスタが未登録です</span>'}</div></div>
    <div class="field"><label>メモ</label><textarea id="f_memo">${isEdit ? escapeHtml(existing.memo || '') : ''}</textarea></div>
    <button id="f_save" class="btn-primary">${isEdit ? '更新' : '追加'}</button>
  `;

  host.querySelector('#f_save').addEventListener('click', async () => {
    const code = host.querySelector('#f_code').value.trim();
    const name = host.querySelector('#f_name').value.trim();
    if (!code || !name) { alert('コードと名前は必須です'); return; }
    if (!isEdit) {
      const existingCat = await get('catMaster', code);
      if (existingCat) { alert('既に存在するコードです'); return; }
    }
    const foodCandidates = Array.from(host.querySelectorAll('.chk-list input:checked')).map(i => i.value);
    const catData = {
      code,
      name,
      birthDate: host.querySelector('#f_birth').value,
      sex: host.querySelector('#f_sex').value,
      foodCandidates,
      memo: host.querySelector('#f_memo').value
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

  let html = `<div class="panel"><div class="panel-header"><h3>餌マスタ</h3></div>`;
  foods.forEach(f => {
    const formName = formCodes.find(fc => fc.code === f.formCode);
    const typeName = typeCodes.find(tc => tc.code === f.typeCode);
    const makerName = makerCodes.find(mc => mc.code === f.makerCode);
    html += `<div class="card">
      <div class="card-title">${escapeHtml(f.name)} <span class="muted">(${escapeHtml(f.code)})</span></div>
      <div class="kv">メーカー: ${escapeHtml(makerName ? makerName.name : '-')}</div>
      <div class="kv">100gあたりカロリー: ${escapeHtml(f.caloriePer100g)} kcal</div>
      <div class="kv">形態: ${escapeHtml(formName ? formName.name : '-')}</div>
      <div class="kv">種類: ${escapeHtml(typeName ? typeName.name : '-')}</div>
      <div class="kv">給仕デフォルト量: ${escapeHtml(f.defaultAmountG)} g</div>
      <div class="actions">
        <button class="btn-small" data-edit-food="${escapeHtml(f.code)}">編集</button>
        <button class="btn-small danger" data-del-food="${escapeHtml(f.code)}">削除</button>
      </div>
    </div>`;
  });
  html += `<div class="card"><div class="card-title">新規餌を追加</div><div id="foodForm"></div></div></div>`;
  content.innerHTML = html;

  renderFoodForm(content.querySelector('#foodForm'), null, formCodes, typeCodes, makerCodes, () => renderFoodMaster(content));

  content.querySelectorAll('[data-edit-food]').forEach(btn => btn.addEventListener('click', async () => {
    const code = btn.dataset.editFood;
    const f = await get('foodMaster', code);
    const formHost = el(`<div class="card"><div class="card-title">餌編集: ${escapeHtml(f.name)}</div><div></div></div>`);
    btn.closest('.card').replaceWith(formHost);
    renderFoodForm(formHost.querySelector('div:last-child'), f, formCodes, typeCodes, makerCodes, () => renderFoodMaster(content));
  }));

  content.querySelectorAll('[data-del-food]').forEach(btn => btn.addEventListener('click', async () => {
    const code = btn.dataset.delFood;
    const feeding = await getAll('feedingLog');
    const usedInFeeding = feeding.some(x => x.foodCode === code || x.sourceCode === code || (x.breakdown || []).some(b => b.foodCode === code));
    const cats = await getAll('catMaster');
    const usedInCats = cats.some(c => (c.foodCandidates || []).includes(code));
    const recipes = await getAll('recipeMaster');
    const usedInRecipes = recipes.some(r => (r.components || []).some(c => c.foodCode === code));
    if (usedInFeeding || usedInCats || usedInRecipes) { alert('この餌は使用中のため削除できません'); return; }
    if (!confirm('この餌を削除しますか？')) return;
    await remove('foodMaster', code);
    renderFoodMaster(content);
  }));
}

function renderFoodForm(host, existing, formCodes, typeCodes, makerCodes, onSaved) {
  const isEdit = !!existing;
  const options = formCodes.map(fc => `<option value="${escapeHtml(fc.code)}" ${isEdit && existing.formCode === fc.code ? 'selected' : ''}>${escapeHtml(fc.name)}</option>`).join('');
  const typeOptions = typeCodes.map(tc => `<option value="${escapeHtml(tc.code)}" ${isEdit && existing.typeCode === tc.code ? 'selected' : ''}>${escapeHtml(tc.name)}</option>`).join('');
  const makerOptions = makerCodes.map(mc => `<option value="${escapeHtml(mc.code)}" ${isEdit && existing.makerCode === mc.code ? 'selected' : ''}>${escapeHtml(mc.name)}</option>`).join('');
  host.innerHTML = `
    <div class="field"><label>コード</label><input id="ff_code" ${isEdit ? 'disabled' : ''} value="${isEdit ? escapeHtml(existing.code) : ''}"></div>
    <div class="field"><label>メーカー</label><select id="ff_maker"><option value="">未選択</option>${makerOptions || ''}</select>${makerCodes.length === 0 ? '<span class="muted">コードマスタの「メーカー」にコードを追加してください</span>' : ''}</div>
    <div class="field"><label>名称</label><input id="ff_name" value="${isEdit ? escapeHtml(existing.name) : ''}"></div>
    <div class="field"><label>100gあたりカロリー(kcal)</label><input id="ff_cal" type="number" step="0.1" value="${isEdit ? existing.caloriePer100g : ''}"></div>
    <div class="field"><label>形態</label><select id="ff_form"><option value="">未選択</option>${options}</select></div>
    <div class="field"><label>種類</label><select id="ff_type"><option value="">未選択</option>${typeOptions}</select></div>
    <div class="field"><label>給仕デフォルト量(g)</label><input id="ff_default" type="number" step="0.1" value="${isEdit ? existing.defaultAmountG : ''}"></div>
    <button id="ff_save" class="btn-primary">${isEdit ? '更新' : '追加'}</button>
  `;
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
      caloriePer100g: Number(host.querySelector('#ff_cal').value) || 0,
      formCode: host.querySelector('#ff_form').value,
      typeCode: host.querySelector('#ff_type').value,
      defaultAmountG: Number(host.querySelector('#ff_default').value) || 0
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

  function componentsLabel(components) {
    return (components || []).map(c => {
      const f = foods.find(x => x.code === c.foodCode);
      return `${f ? f.name : c.foodCode}:${c.ratio}`;
    }).join(' / ');
  }

  let html = `<div class="panel"><div class="panel-header"><h3>レシピ</h3></div>
    <p class="muted">複数の餌を混ぜて与える場合だけここに登録します。単一の餌はそのまま給餌管理画面から選べます。</p>`;
  recipes.forEach(r => {
    html += `<div class="card">
      <div class="card-title">${escapeHtml(r.name)} <span class="muted">(${escapeHtml(r.code)})</span></div>
      <div class="kv">配合: ${escapeHtml(componentsLabel(r.components)) || '-'}</div>
      <div class="kv">メモ: ${escapeHtml(r.memo || '-')}</div>
      <div class="actions">
        <button class="btn-small" data-edit-recipe="${escapeHtml(r.code)}">編集</button>
        <button class="btn-small danger" data-del-recipe="${escapeHtml(r.code)}">削除</button>
      </div>
    </div>`;
  });
  html += `<div class="card"><div class="card-title">新規レシピを追加</div><div id="recipeForm"></div></div></div>`;
  content.innerHTML = html;

  renderRecipeForm(content.querySelector('#recipeForm'), null, foods, () => renderRecipeMaster(content));

  content.querySelectorAll('[data-edit-recipe]').forEach(btn => btn.addEventListener('click', async () => {
    const code = btn.dataset.editRecipe;
    const r = await get('recipeMaster', code);
    const formHost = el(`<div class="card"><div class="card-title">編集: ${escapeHtml(r.name)}</div><div></div></div>`);
    btn.closest('.card').replaceWith(formHost);
    renderRecipeForm(formHost.querySelector('div:last-child'), r, foods, () => renderRecipeMaster(content));
  }));

  content.querySelectorAll('[data-del-recipe]').forEach(btn => btn.addEventListener('click', async () => {
    const code = btn.dataset.delRecipe;
    const feeding = await getAll('feedingLog');
    const used = feeding.some(x => x.sourceType === 'RECIPE' && x.sourceCode === code);
    if (used) { alert('このレシピは使用中のため削除できません'); return; }
    if (!confirm('削除しますか？')) return;
    await remove('recipeMaster', code);
    renderRecipeMaster(content);
  }));
}

function renderRecipeForm(host, existing, foods, onSaved) {
  const isEdit = !!existing;
  const existingRatios = {};
  if (isEdit) (existing.components || []).forEach(c => { existingRatios[c.foodCode] = c.ratio; });

  const rows = foods.map(f => {
    const checked = existingRatios[f.code] != null;
    return `<div class="field" style="flex-direction:row; align-items:center; gap:8px;">
      <label class="chk" style="flex:1;"><input type="checkbox" class="recipe-food-chk" value="${escapeHtml(f.code)}" ${checked ? 'checked' : ''}> ${escapeHtml(f.name)}</label>
      <input type="number" step="0.1" class="recipe-food-ratio" data-for="${escapeHtml(f.code)}" placeholder="比率" style="width:80px;" value="${checked ? existingRatios[f.code] : ''}">
    </div>`;
  }).join('');

  host.innerHTML = `
    <div class="field"><label>コード</label><input id="rc_code" ${isEdit ? 'disabled' : ''} value="${isEdit ? escapeHtml(existing.code) : ''}"></div>
    <div class="field"><label>名称</label><input id="rc_name" value="${isEdit ? escapeHtml(existing.name) : ''}"></div>
    <div class="field"><label>配合する餌と比率（例: 餌A 6 / 餌B 4）</label>${rows || '<span class="muted">先に餌マスタを登録してください</span>'}</div>
    <div class="field"><label>メモ</label><input id="rc_memo" value="${isEdit ? escapeHtml(existing.memo || '') : ''}"></div>
    <button id="rc_save" class="btn-primary">${isEdit ? '更新' : '追加'}</button>
  `;

  host.querySelector('#rc_save').addEventListener('click', async () => {
    const code = host.querySelector('#rc_code').value.trim();
    const name = host.querySelector('#rc_name').value.trim();
    if (!code || !name) { alert('コードと名称は必須です'); return; }
    if (!isEdit) {
      const existingR = await get('recipeMaster', code);
      if (existingR) { alert('既に存在するコードです'); return; }
    }
    const components = [];
    host.querySelectorAll('.recipe-food-chk').forEach(chk => {
      if (!chk.checked) return;
      const ratioInput = chk.closest('.field').querySelector('.recipe-food-ratio');
      const ratio = Number(ratioInput.value) || 1;
      components.push({ foodCode: chk.value, ratio });
    });
    if (components.length < 2) { alert('レシピは2種類以上の餌を選んでください（単一の餌は登録不要です）'); return; }
    const data = { code, name, components, memo: host.querySelector('#rc_memo').value };
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

  let html = `<div class="panel"><div class="panel-header"><h3>薬・サプリマスタ</h3></div>`;
  medicines.forEach(m => {
    const unitName = units.find(u => u.code === m.unitCode);
    const effectName = effects.find(e => e.code === m.effectCode);
    html += `<div class="card">
      <div class="card-title">${escapeHtml(m.name)} <span class="muted">(${escapeHtml(m.code)})</span></div>
      <div class="kv">デフォルト用量: ${m.defaultDose != null && m.defaultDose !== '' ? escapeHtml(m.defaultDose) + escapeHtml(unitName ? unitName.name : '') : '-'}</div>
      <div class="kv">効能: ${escapeHtml(effectName ? effectName.name : '-')}</div>
      <div class="kv">メモ: ${escapeHtml(m.memo || '-')}</div>
      <div class="actions">
        <button class="btn-small" data-edit-medicine="${escapeHtml(m.code)}">編集</button>
        <button class="btn-small danger" data-del-medicine="${escapeHtml(m.code)}">削除</button>
      </div>
    </div>`;
  });
  html += `<div class="card"><div class="card-title">新規登録</div><div id="medicineForm"></div></div></div>`;
  content.innerHTML = html;

  renderMedicineForm(content.querySelector('#medicineForm'), null, units, effects, () => renderMedicineMaster(content));

  content.querySelectorAll('[data-edit-medicine]').forEach(btn => btn.addEventListener('click', async () => {
    const code = btn.dataset.editMedicine;
    const m = await get('medicineMaster', code);
    const formHost = el(`<div class="card"><div class="card-title">編集: ${escapeHtml(m.name)}</div><div></div></div>`);
    btn.closest('.card').replaceWith(formHost);
    renderMedicineForm(formHost.querySelector('div:last-child'), m, units, effects, () => renderMedicineMaster(content));
  }));

  content.querySelectorAll('[data-del-medicine]').forEach(btn => btn.addEventListener('click', async () => {
    const code = btn.dataset.delMedicine;
    const logs = await getAll('medicineLog');
    const used = logs.some(l => l.medicineCode === code);
    if (used) { alert('このサプリ・薬は使用中のため削除できません'); return; }
    if (!confirm('削除しますか？')) return;
    await remove('medicineMaster', code);
    renderMedicineMaster(content);
  }));
}

function renderMedicineForm(host, existing, units, effects, onSaved) {
  const isEdit = !!existing;
  const unitOptions = units.map(u => `<option value="${escapeHtml(u.code)}" ${isEdit && existing.unitCode === u.code ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('');
  const effectOptions = effects.map(e => `<option value="${escapeHtml(e.code)}" ${isEdit && existing.effectCode === e.code ? 'selected' : ''}>${escapeHtml(e.name)}</option>`).join('');
  host.innerHTML = `
    <div class="field"><label>コード</label><input id="mm_code" ${isEdit ? 'disabled' : ''} value="${isEdit ? escapeHtml(existing.code) : ''}"></div>
    <div class="field"><label>名称</label><input id="mm_name" value="${isEdit ? escapeHtml(existing.name) : ''}"></div>
    <div class="field"><label>デフォルト用量</label><input id="mm_dose" type="number" step="0.01" value="${isEdit && existing.defaultDose != null ? existing.defaultDose : ''}"></div>
    <div class="field"><label>単位</label><select id="mm_unit"><option value="">未選択</option>${unitOptions}</select></div>
    <div class="field"><label>効能</label><select id="mm_effect"><option value="">未選択</option>${effectOptions}</select></div>
    <div class="field"><label>メモ</label><input id="mm_memo" value="${isEdit ? escapeHtml(existing.memo || '') : ''}"></div>
    <button id="mm_save" class="btn-primary">${isEdit ? '更新' : '追加'}</button>
  `;
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
      defaultDose: doseVal === '' ? null : Number(doseVal),
      unitCode: host.querySelector('#mm_unit').value,
      effectCode: host.querySelector('#mm_effect').value,
      memo: host.querySelector('#mm_memo').value
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
async function renderIO(content, callbacks) {
  content.innerHTML = `
    <div class="panel">
      <div class="card">
        <div class="card-title">エクスポート</div>
        <p class="muted">マスタ・日々データをすべてまとめてJSONファイルとして書き出します。</p>
        <button id="exportBtn" class="btn-primary">エクスポート</button>
      </div>
      <div class="card">
        <div class="card-title">インポート</div>
        <p class="muted">エクスポートしたJSONファイルを読み込みます。既存データは上書きされます。</p>
        <input type="file" id="importFile" accept="application/json">
        <button id="importBtn" class="btn-primary">インポート</button>
      </div>
      <div class="card">
        <div class="card-title">初期化</div>
        <p class="muted">保存されているデータをすべて削除し、js/initial-data.js の内容だけを反映し直します。元に戻せません。</p>
        <button id="resetBtn" class="btn-small danger">初期化する</button>
      </div>
    </div>
  `;
  const { exportAll, importAll } = await import('./io.js');
  content.querySelector('#exportBtn').addEventListener('click', () => exportAll());
  content.querySelector('#importBtn').addEventListener('click', async () => {
    const fileInput = content.querySelector('#importFile');
    if (!fileInput.files[0]) { alert('ファイルを選択してください'); return; }
    if (!confirm('既存データを上書きします。よろしいですか？')) return;
    await importAll(fileInput.files[0]);
    if (callbacks && callbacks.onCatsChanged) callbacks.onCatsChanged();
    alert('インポートしました');
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

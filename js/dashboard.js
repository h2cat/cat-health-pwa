import { getAll, get, put, remove, getByIndex } from './db.js';
import { escapeHtml, el } from './utils.js';

export const FOOD_FORM_CATEGORY = 'FOOD_FORM';

// 初回起動時のマスタ種seed（餌の形態カテゴリが無ければ作る）
export async function seedDefaults() {
  const rows = await getByIndex('codeMaster', 'byCategory', FOOD_FORM_CATEGORY);
  if (rows.length === 0) {
    await put('codeMaster', { category: FOOD_FORM_CATEGORY, code: '', name: '餌の形態' });
    await put('codeMaster', { category: FOOD_FORM_CATEGORY, code: 'DRY', name: 'ドライ' });
    await put('codeMaster', { category: FOOD_FORM_CATEGORY, code: 'WET', name: 'ウェット' });
    await put('codeMaster', { category: FOOD_FORM_CATEGORY, code: 'LIQUID', name: 'リキッド' });
  }
}

export async function renderDashboard(container, callbacks) {
  container.innerHTML = `
    <div class="subtabs">
      <button data-sub="code" class="subtab active">コードマスタ</button>
      <button data-sub="cat" class="subtab">猫マスタ</button>
      <button data-sub="food" class="subtab">餌マスタ</button>
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
    const used = foods.some(f => f.formCode === row.code);
    if (used) { alert('この項目は餌マスタで使用されているため削除できません'); return; }
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
    if (daily.length > 0 || feeding.length > 0) {
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

  let html = `<div class="panel"><div class="panel-header"><h3>餌マスタ</h3></div>`;
  foods.forEach(f => {
    const formName = formCodes.find(fc => fc.code === f.formCode);
    html += `<div class="card">
      <div class="card-title">${escapeHtml(f.name)} <span class="muted">(${escapeHtml(f.code)})</span></div>
      <div class="kv">メーカー: ${escapeHtml(f.maker || '-')}</div>
      <div class="kv">100gあたりカロリー: ${escapeHtml(f.caloriePer100g)} kcal</div>
      <div class="kv">形態: ${escapeHtml(formName ? formName.name : '-')}</div>
      <div class="kv">給仕デフォルト量: ${escapeHtml(f.defaultAmountG)} g</div>
      <div class="actions">
        <button class="btn-small" data-edit-food="${escapeHtml(f.code)}">編集</button>
        <button class="btn-small danger" data-del-food="${escapeHtml(f.code)}">削除</button>
      </div>
    </div>`;
  });
  html += `<div class="card"><div class="card-title">新規餌を追加</div><div id="foodForm"></div></div></div>`;
  content.innerHTML = html;

  renderFoodForm(content.querySelector('#foodForm'), null, formCodes, () => renderFoodMaster(content));

  content.querySelectorAll('[data-edit-food]').forEach(btn => btn.addEventListener('click', async () => {
    const code = btn.dataset.editFood;
    const f = await get('foodMaster', code);
    const formHost = el(`<div class="card"><div class="card-title">餌編集: ${escapeHtml(f.name)}</div><div></div></div>`);
    btn.closest('.card').replaceWith(formHost);
    renderFoodForm(formHost.querySelector('div:last-child'), f, formCodes, () => renderFoodMaster(content));
  }));

  content.querySelectorAll('[data-del-food]').forEach(btn => btn.addEventListener('click', async () => {
    const code = btn.dataset.delFood;
    const feeding = await getAll('feedingLog');
    const usedInFeeding = feeding.some(x => x.foodCode === code);
    const cats = await getAll('catMaster');
    const usedInCats = cats.some(c => (c.foodCandidates || []).includes(code));
    if (usedInFeeding || usedInCats) { alert('この餌は使用中のため削除できません'); return; }
    if (!confirm('この餌を削除しますか？')) return;
    await remove('foodMaster', code);
    renderFoodMaster(content);
  }));
}

function renderFoodForm(host, existing, formCodes, onSaved) {
  const isEdit = !!existing;
  const options = formCodes.map(fc => `<option value="${escapeHtml(fc.code)}" ${isEdit && existing.formCode === fc.code ? 'selected' : ''}>${escapeHtml(fc.name)}</option>`).join('');
  host.innerHTML = `
    <div class="field"><label>コード</label><input id="ff_code" ${isEdit ? 'disabled' : ''} value="${isEdit ? escapeHtml(existing.code) : ''}"></div>
    <div class="field"><label>メーカー</label><input id="ff_maker" value="${isEdit ? escapeHtml(existing.maker || '') : ''}"></div>
    <div class="field"><label>名称</label><input id="ff_name" value="${isEdit ? escapeHtml(existing.name) : ''}"></div>
    <div class="field"><label>100gあたりカロリー(kcal)</label><input id="ff_cal" type="number" step="0.1" value="${isEdit ? existing.caloriePer100g : ''}"></div>
    <div class="field"><label>形態</label><select id="ff_form"><option value="">未選択</option>${options}</select></div>
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
      maker: host.querySelector('#ff_maker').value,
      name,
      caloriePer100g: Number(host.querySelector('#ff_cal').value) || 0,
      formCode: host.querySelector('#ff_form').value,
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

// ===== データ入出力 =====
async function renderIO(content, callbacks) {
  content.innerHTML = `
    <div class="panel">
      <div class="card">
        <div class="card-title">エクスポート</div>
        <p class="muted">マスタ3種＋日々データをまとめてJSONファイルとして書き出します。</p>
        <button id="exportBtn" class="btn-primary">エクスポート</button>
      </div>
      <div class="card">
        <div class="card-title">インポート</div>
        <p class="muted">エクスポートしたJSONファイルを読み込みます。既存データは上書きされます。</p>
        <input type="file" id="importFile" accept="application/json">
        <button id="importBtn" class="btn-primary">インポート</button>
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
}

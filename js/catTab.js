import { get, put, remove, getByIndex } from './db.js';
import { escapeHtml, todayStr, formatDate, calcCalorie, floorToTenMinutes } from './utils.js';
import { STOOL_STATE_CATEGORY, VOMIT_STATE_CATEGORY, MED_UNIT_CATEGORY, MED_EFFECT_CATEGORY, DAILY_EVENT_CATEGORY, FOOD_FORM_CATEGORY, FOOD_TYPE_CATEGORY, MAKER_CATEGORY } from './dashboard.js';

const stateMap = {}; // catCode -> { date, calendarMonth (Date), activeSection }

function getState(catCode) {
  if (!stateMap[catCode]) {
    const today = new Date();
    stateMap[catCode] = { date: todayStr(), calendarMonth: new Date(today.getFullYear(), today.getMonth(), 1), activeSection: 'feeding' };
  }
  return stateMap[catCode];
}

const SECTIONS = [
  { key: 'feeding', icon: '🍴', title: '給餌管理' },
  { key: 'medicine', icon: '💊', title: 'サプリ・投薬管理' },
  { key: 'poop', icon: '💩', title: 'うんち記録' },
  { key: 'vomit', icon: '🤮', title: 'ゲロ記録' },
  { key: 'daily', icon: '🏥', title: '日々管理' },
  { key: 'memo', icon: '📝', title: 'メモ' }
];

export async function renderCatTab(container, catCode) {
  const cat = await get('catMaster', catCode);
  if (!cat) { container.innerHTML = '<p>猫データが見つかりません</p>'; return; }
  const state = getState(catCode);

  const navHtml = SECTIONS.map(s => `<button class="icon-nav-btn ${state.activeSection === s.key ? 'active' : ''}" data-section="${s.key}" title="${s.title}">${s.icon}</button>`).join('');

  container.innerHTML = `
    <div class="cat-header">
      <h2>${escapeHtml(cat.name)}</h2>
      <div class="date-bar">
        <span id="selDate" class="sel-date">${escapeHtml(state.date)}</span>
        ${state.date !== todayStr() ? '<button id="backToday" class="btn-tiny">今日に戻る</button>' : ''}
      </div>
    </div>
    <div class="icon-nav">${navHtml}</div>
    <div id="sectionHost"></div>
    <div id="calendarSection"></div>
  `;

  const backBtn = container.querySelector('#backToday');
  if (backBtn) backBtn.addEventListener('click', () => {
    state.date = todayStr();
    renderCatTab(container, catCode);
  });

  container.querySelectorAll('.icon-nav-btn').forEach(btn => btn.addEventListener('click', () => {
    state.activeSection = btn.dataset.section;
    renderCatTab(container, catCode);
  }));

  const calHost = container.querySelector('#calendarSection');
  const refreshCalendar = () => renderCalendarSection(calHost, cat, state, container);

  const sectionHost = container.querySelector('#sectionHost');
  if (state.activeSection === 'feeding') await renderFeedingSection(sectionHost, cat, state, refreshCalendar);
  else if (state.activeSection === 'medicine') await renderMedicineSection(sectionHost, cat, state, refreshCalendar);
  else if (state.activeSection === 'poop') await renderExcretionTypeSection(sectionHost, cat, state, refreshCalendar, 'POOP');
  else if (state.activeSection === 'vomit') await renderExcretionTypeSection(sectionHost, cat, state, refreshCalendar, 'VOMIT');
  else if (state.activeSection === 'daily') await renderDailySection(sectionHost, cat, state, refreshCalendar);
  else if (state.activeSection === 'memo') await renderMemoSection(sectionHost, cat, state, refreshCalendar);

  await refreshCalendar();
}

// ===== 給餌管理 =====
function resolveFeedSource(e, allFoods, allRecipes) {
  const type = e.sourceType || (e.foodCode ? 'FOOD' : null);
  const code = e.sourceCode || e.foodCode || null;
  if (!type || !code) return { type: null, code: null, name: '-' };
  if (type === 'RECIPE') {
    const r = allRecipes.find(x => x.code === code);
    return { type, code, name: r ? r.name : code };
  }
  const f = allFoods.find(x => x.code === code);
  return { type: 'FOOD', code, name: f ? f.name : code };
}

async function renderFeedingSection(host, cat, state, refreshCalendar) {
  const { getAll } = await import('./db.js');
  const allFoods = await getAll('foodMaster');
  const allRecipes = await getAll('recipeMaster');
  const makers = (await getByIndex('codeMaster', 'byCategory', MAKER_CATEGORY)).filter(c => c.code !== '');
  const forms = (await getByIndex('codeMaster', 'byCategory', FOOD_FORM_CATEGORY)).filter(c => c.code !== '');
  const types = (await getByIndex('codeMaster', 'byCategory', FOOD_TYPE_CATEGORY)).filter(c => c.code !== '');

  const entries = (await getByIndex('feedingLog', 'byCatDate', [cat.code, state.date])).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const totalCal = Math.round(entries.reduce((s, e) => s + (e.calorie || 0), 0) * 10) / 10;

  const makerOptionsHtml = makers.map(m => `<option value="${escapeHtml(m.code)}">${escapeHtml(m.name)}</option>`).join('');
  const formOptionsHtml = forms.map(f => `<option value="${escapeHtml(f.code)}">${escapeHtml(f.name)}</option>`).join('');
  const typeOptionsHtml = types.map(t => `<option value="${escapeHtml(t.code)}">${escapeHtml(t.name)}</option>`).join('');

  const rowsHtml = entries.map(e => {
    const src = resolveFeedSource(e, allFoods, allRecipes);
    const kindLabel = e.kind === 'SERVE' ? '提供' : '摂取';
    const providedText = e.providedAmount != null ? `${e.providedAmount}g` : '-';
    const eatenText = e.eatenAmount != null ? `${e.eatenAmount}g` : '-';
    const calorieText = e.kind === 'SERVE' ? '-' : `${e.calorie || 0}kcal`;
    return `<tr>
      <td>${escapeHtml(e.time)}</td>
      <td>${kindLabel}</td>
      <td>${escapeHtml(src.name)}</td>
      <td>${providedText}</td>
      <td>${eatenText}</td>
      <td>${calorieText}</td>
      <td>${escapeHtml(e.memo || '-')}</td>
      <td><button class="btn-tiny danger" data-del-feed="${e.id}">削除</button></td>
    </tr>`;
  }).join('');

  host.innerHTML = `
    <div class="card">
      <div class="card-title">給餌管理</div>
      <table class="tbl"><thead><tr><th>時刻</th><th>種別</th><th>餌・レシピ</th><th>提供量</th><th>摂取量</th><th>カロリー</th><th>メモ</th><th></th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="8" class="muted">この日はまだ記録がありません</td></tr>'}</tbody></table>
      <div class="total-cal">合計カロリー: ${totalCal} kcal</div>
      <div class="feed-form">
        <div class="field"><label>種別</label>
          <select id="feedKind">
            <option value="INTAKE">摂取</option>
            <option value="SERVE">提供</option>
          </select>
        </div>
        <div class="field"><label>時刻（10分単位に切り捨て）</label><input id="feedTime" type="time" step="600" value="${floorToTenMinutes(nowTimeStr())}"></div>
        <div class="feed-filter">
          <input id="feedSearch" type="text" placeholder="餌名で検索">
          <select id="filterMaker"><option value="">メーカー(すべて)</option>${makerOptionsHtml}</select>
          <select id="filterForm"><option value="">形態(すべて)</option>${formOptionsHtml}</select>
          <select id="filterType"><option value="">種類(すべて)</option>${typeOptionsHtml}</select>
        </div>
        <div class="field"><label>餌・レシピ</label><select id="feedSource"></select></div>
        <div class="field"><label id="feedProvidedLabel">提供量(g)</label><input id="feedProvided" type="number" step="0.1"></div>
        <div class="field" id="feedEatenField"><label>摂取量(g)</label><input id="feedEaten" type="number" step="0.1"></div>
        <div class="field"><label>メモ</label><input id="feedMemo"></div>
        <button id="feedSave" class="btn-primary">入力確定</button>
      </div>
    </div>
  `;

  const sourceSelect = host.querySelector('#feedSource');
  const searchInput = host.querySelector('#feedSearch');
  const filterMaker = host.querySelector('#filterMaker');
  const filterForm = host.querySelector('#filterForm');
  const filterType = host.querySelector('#filterType');
  const providedInput = host.querySelector('#feedProvided');
  const eatenInput = host.querySelector('#feedEaten');
  const eatenField = host.querySelector('#feedEatenField');
  const providedLabel = host.querySelector('#feedProvidedLabel');
  const kindSelect = host.querySelector('#feedKind');
  const timeInput = host.querySelector('#feedTime');
  const memoInput = host.querySelector('#feedMemo');

  function getFilteredFoods() {
    const q = (searchInput.value || '').trim().toLowerCase();
    return allFoods.filter(f => {
      if (filterMaker.value && f.makerCode !== filterMaker.value) return false;
      if (filterForm.value && f.formCode !== filterForm.value) return false;
      if (filterType.value && f.typeCode !== filterType.value) return false;
      if (q && !(f.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }
  function getFilteredRecipes() {
    const q = (searchInput.value || '').trim().toLowerCase();
    if (!q) return allRecipes;
    return allRecipes.filter(r => (r.name || '').toLowerCase().includes(q));
  }
  function buildSourceOptionsHtml() {
    const foods = getFilteredFoods();
    const recipes = getFilteredRecipes();
    const recipeOptions = recipes.map(r => `<option value="R:${escapeHtml(r.code)}">${escapeHtml(r.name)}</option>`).join('');
    const foodOptions = foods.map(f => `<option value="F:${escapeHtml(f.code)}">${escapeHtml(f.name)}</option>`).join('');
    let html = '';
    if (recipes.length) html += `<optgroup label="レシピ">${recipeOptions}</optgroup>`;
    if (foods.length) html += `<optgroup label="餌">${foodOptions}</optgroup>`;
    if (!recipes.length && !foods.length) html = '<option value="">該当する餌・レシピがありません</option>';
    return html;
  }
  function rebuildSourceSelect(preserveValue) {
    const prev = preserveValue !== undefined ? preserveValue : sourceSelect.value;
    sourceSelect.innerHTML = buildSourceOptionsHtml();
    if (prev && Array.from(sourceSelect.options).some(o => o.value === prev)) {
      sourceSelect.value = prev;
    }
  }

  const lastSelKey = `catHealth:lastFeedSelection:${cat.code}`;
  const lastSel = localStorage.getItem(lastSelKey);
  rebuildSourceSelect(null);
  {
    const optionValues = Array.from(sourceSelect.options).map(o => o.value);
    if (lastSel && optionValues.includes(lastSel)) {
      sourceSelect.value = lastSel;
    } else if (allFoods.length && optionValues.includes(`F:${allFoods[0].code}`)) {
      sourceSelect.value = `F:${allFoods[0].code}`;
    } else if (allRecipes.length && optionValues.includes(`R:${allRecipes[0].code}`)) {
      sourceSelect.value = `R:${allRecipes[0].code}`;
    }
  }

  timeInput.addEventListener('change', () => { timeInput.value = floorToTenMinutes(timeInput.value); });

  function applyDefault() {
    const val = sourceSelect.value;
    if (!val) return;
    const [t, c] = val.split(':');
    if (t === 'F') {
      const f = allFoods.find(x => x.code === c);
      if (f && f.defaultAmountG) providedInput.value = f.defaultAmountG;
    }
  }
  sourceSelect.addEventListener('change', applyDefault);
  applyDefault();

  searchInput.addEventListener('input', () => { rebuildSourceSelect(); applyDefault(); });
  [filterMaker, filterForm, filterType].forEach(sel => sel.addEventListener('change', () => { rebuildSourceSelect(); applyDefault(); }));

  function updateKindUI() {
    const isIntake = kindSelect.value === 'INTAKE';
    eatenField.style.display = isIntake ? '' : 'none';
    providedLabel.textContent = isIntake ? '提供量(g)' : '提供量(g)（任意）';
  }
  kindSelect.addEventListener('change', updateKindUI);
  updateKindUI();

  host.querySelectorAll('[data-del-feed]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('この記録を削除しますか？')) return;
    await remove('feedingLog', Number(btn.dataset.delFeed));
    renderFeedingSection(host, cat, state, refreshCalendar);
    if (refreshCalendar) refreshCalendar();
  }));

  const saveBtn = host.querySelector('#feedSave');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const sourceVal = sourceSelect.value;
    if (!sourceVal) { alert('餌・レシピを選択してください'); return; }
    const [srcType, srcCode] = sourceVal.split(':');
    const kind = kindSelect.value;
    const time = floorToTenMinutes(timeInput.value);
    if (!time) { alert('時刻を入力してください'); return; }

    const providedStr = providedInput.value;
    const eatenStr = eatenInput.value;
    if (kind === 'INTAKE') {
      if (providedStr === '') { alert('摂取記録には提供量の入力が必要です'); return; }
      if (eatenStr === '') { alert('摂取量を入力してください'); return; }
    }
    const provided = providedStr === '' ? null : Number(providedStr);
    const eaten = eatenStr === '' ? null : Number(eatenStr);

    let breakdown = [];
    let calorie = 0;
    if (kind === 'INTAKE' && eaten != null) {
      if (srcType === 'F') {
        const food = allFoods.find(f => f.code === srcCode);
        const cal = calcCalorie(food ? food.caloriePer100g : 0, eaten);
        breakdown = [{ foodCode: srcCode, grams: eaten, calorie: cal }];
        calorie = cal;
      } else {
        const recipe = allRecipes.find(r => r.code === srcCode);
        const totalRatio = (recipe.components || []).reduce((s, c) => s + (Number(c.ratio) || 0), 0) || 1;
        breakdown = (recipe.components || []).map(c => {
          const grams = Math.round(eaten * ((Number(c.ratio) || 0) / totalRatio) * 100) / 100;
          const food = allFoods.find(f => f.code === c.foodCode);
          return { foodCode: c.foodCode, grams, calorie: calcCalorie(food ? food.caloriePer100g : 0, grams) };
        });
        calorie = Math.round(breakdown.reduce((s, b) => s + b.calorie, 0) * 10) / 10;
      }
    }

    await put('feedingLog', {
      catCode: cat.code,
      date: state.date,
      time,
      kind,
      sourceType: srcType === 'R' ? 'RECIPE' : 'FOOD',
      sourceCode: srcCode,
      providedAmount: provided,
      eatenAmount: eaten,
      breakdown,
      calorie,
      memo: memoInput.value
    });

    localStorage.setItem(lastSelKey, sourceVal);
    renderFeedingSection(host, cat, state, refreshCalendar);
    if (refreshCalendar) refreshCalendar();
  });
}

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ===== サプリ・投薬管理 =====
async function renderMedicineSection(host, cat, state, refreshCalendar) {
  const { getAll } = await import('./db.js');
  const allMedicines = await getAll('medicineMaster');
  const units = (await getByIndex('codeMaster', 'byCategory', MED_UNIT_CATEGORY)).filter(u => u.code !== '');
  const effects = (await getByIndex('codeMaster', 'byCategory', MED_EFFECT_CATEGORY)).filter(e => e.code !== '');
  const entries = (await getByIndex('medicineLog', 'byCatDate', [cat.code, state.date])).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  function unitName(code) {
    const u = units.find(x => x.code === code);
    return u ? u.name : '';
  }
  function effectName(code) {
    const eff = effects.find(x => x.code === code);
    return eff ? eff.name : '-';
  }

  const rowsHtml = entries.map(e => {
    const m = allMedicines.find(x => x.code === e.medicineCode);
    const doseText = e.dose != null ? `${e.dose}${unitName(m ? m.unitCode : '')}` : '-';
    return `<tr>
      <td>${escapeHtml(e.time)}</td>
      <td>${escapeHtml(m ? m.name : e.medicineCode)}</td>
      <td>${escapeHtml(m ? effectName(m.effectCode) : '-')}</td>
      <td>${escapeHtml(doseText)}</td>
      <td><button class="btn-tiny danger" data-del-medicine-log="${e.id}">削除</button></td>
    </tr>`;
  }).join('');

  host.innerHTML = `
    <div class="card">
      <div class="card-title">サプリ・投薬管理</div>
      <table class="tbl"><thead><tr><th>時刻</th><th>サプリ・薬</th><th>効能</th><th>用量</th><th></th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="5" class="muted">この日はまだ記録がありません</td></tr>'}</tbody></table>
      <div class="feed-form">
        <div class="field"><label>時刻（10分単位に切り捨て）</label><input id="medTime" type="time" step="600" value="${floorToTenMinutes(nowTimeStr())}"></div>
        <div class="feed-filter">
          <input id="medSearch" type="text" placeholder="名前で検索">
          <select id="filterKind">
            <option value="">薬・サプリ(すべて)</option>
            <option value="DRUG">薬</option>
            <option value="SUPPLEMENT">サプリ</option>
          </select>
        </div>
        <div class="field"><label>サプリ・薬</label><select id="medSelect"></select></div>
        <div class="field"><label id="medDoseLabel">用量</label><input id="medDose" type="number" step="0.01"></div>
        <button id="medSave" class="btn-primary">入力確定</button>
      </div>
    </div>
  `;

  const medSelect = host.querySelector('#medSelect');
  const medSearch = host.querySelector('#medSearch');
  const filterKind = host.querySelector('#filterKind');
  const doseInput = host.querySelector('#medDose');
  const doseLabel = host.querySelector('#medDoseLabel');
  const timeInput = host.querySelector('#medTime');
  timeInput.addEventListener('change', () => { timeInput.value = floorToTenMinutes(timeInput.value); });

  function getFilteredMedicines() {
    const q = (medSearch.value || '').trim().toLowerCase();
    return allMedicines.filter(m => {
      if (filterKind.value && (m.kindFlag || 'DRUG') !== filterKind.value) return false;
      if (q && !(m.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }
  function rebuildMedSelect(preserveValue) {
    const prev = preserveValue !== undefined ? preserveValue : medSelect.value;
    const filtered = getFilteredMedicines();
    const options = filtered.map(m => `<option value="${escapeHtml(m.code)}">${escapeHtml(m.name)}</option>`).join('');
    medSelect.innerHTML = filtered.length ? options : '<option value="">該当するサプリ・薬がありません</option>';
    if (prev && Array.from(medSelect.options).some(o => o.value === prev)) {
      medSelect.value = prev;
    }
  }

  function applyDefaultDose() {
    const m = allMedicines.find(x => x.code === medSelect.value);
    if (m && m.defaultDose != null) doseInput.value = m.defaultDose;
    doseLabel.textContent = m ? `用量（${unitName(m.unitCode) || '単位未設定'}）` : '用量';
  }
  if (medSelect) {
    rebuildMedSelect(null);
    applyDefaultDose();
    medSelect.addEventListener('change', applyDefaultDose);
    medSearch.addEventListener('input', () => { rebuildMedSelect(); applyDefaultDose(); });
    filterKind.addEventListener('change', () => { rebuildMedSelect(); applyDefaultDose(); });
  }

  host.querySelectorAll('[data-del-medicine-log]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('この記録を削除しますか？')) return;
    await remove('medicineLog', Number(btn.dataset.delMedicineLog));
    renderMedicineSection(host, cat, state, refreshCalendar);
    if (refreshCalendar) refreshCalendar();
  }));

  const saveBtn = host.querySelector('#medSave');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const medicineCode = medSelect.value;
    if (!medicineCode) { alert('サプリ・薬を選択してください'); return; }
    const time = floorToTenMinutes(timeInput.value);
    if (!time) { alert('時刻を入力してください'); return; }
    const doseStr = doseInput.value;
    const dose = doseStr === '' ? null : Number(doseStr);
    await put('medicineLog', { catCode: cat.code, date: state.date, time, medicineCode, dose });
    renderMedicineSection(host, cat, state, refreshCalendar);
    if (refreshCalendar) refreshCalendar();
  });
}

// ===== うんち／ゲロ記録（アイコンで種別固定） =====
const EXCRETION_CONFIG = {
  POOP: { title: 'うんち記録', category: STOOL_STATE_CATEGORY },
  VOMIT: { title: 'ゲロ記録', category: VOMIT_STATE_CATEGORY }
};

function excretionStateCodes(e) {
  return e.stateCodes || (e.stateCode ? [e.stateCode] : []);
}

async function renderExcretionTypeSection(host, cat, state, refreshCalendar, fixedType) {
  const cfg = EXCRETION_CONFIG[fixedType];
  const states = (await getByIndex('codeMaster', 'byCategory', cfg.category)).filter(s => s.code !== '');
  const entries = (await getByIndex('excretionLog', 'byCatDate', [cat.code, state.date]))
    .filter(e => e.type === fixedType)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  function stateNames(e) {
    return excretionStateCodes(e).map(code => {
      const s = states.find(x => x.code === code);
      return s ? s.name : code;
    }).join('、') || '-';
  }

  const rowsHtml = entries.map(e => `<tr>
    <td>${escapeHtml(e.time)}</td>
    <td>${escapeHtml(stateNames(e))}</td>
    <td>${escapeHtml(e.memo || '-')}</td>
    <td><button class="btn-tiny danger" data-del-excretion="${e.id}">削除</button></td>
  </tr>`).join('');

  const stateChecksHtml = states.map(s => `<label class="chk"><input type="checkbox" class="exc-state-chk" value="${escapeHtml(s.code)}"> ${escapeHtml(s.name)}</label>`).join('');

  host.innerHTML = `
    <div class="card">
      <div class="card-title">${cfg.title}</div>
      <table class="tbl"><thead><tr><th>時刻</th><th>状態</th><th>メモ</th><th></th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="4" class="muted">この日はまだ記録がありません</td></tr>'}</tbody></table>
      <div class="feed-form">
        <div class="field"><label>時刻（10分単位に切り捨て）</label><input id="excTime" type="time" step="600" value="${floorToTenMinutes(nowTimeStr())}"></div>
        <div class="field"><label>状態（複数選択可）</label><div class="chk-list">${stateChecksHtml || '<span class="muted">未登録です</span>'}</div></div>
        <div class="field"><label>メモ</label><input id="excMemo"></div>
        <button id="excSave" class="btn-primary">入力確定</button>
      </div>
    </div>
  `;

  const timeInput = host.querySelector('#excTime');
  timeInput.addEventListener('change', () => { timeInput.value = floorToTenMinutes(timeInput.value); });

  host.querySelectorAll('[data-del-excretion]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('この記録を削除しますか？')) return;
    await remove('excretionLog', Number(btn.dataset.delExcretion));
    renderExcretionTypeSection(host, cat, state, refreshCalendar, fixedType);
    if (refreshCalendar) refreshCalendar();
  }));

  const saveBtn = host.querySelector('#excSave');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const time = floorToTenMinutes(timeInput.value);
    if (!time) { alert('時刻を入力してください'); return; }
    const stateCodes = Array.from(host.querySelectorAll('.exc-state-chk:checked')).map(c => c.value);
    if (stateCodes.length === 0) { alert('状態を1つ以上選択してください'); return; }
    const memo = host.querySelector('#excMemo').value;
    await put('excretionLog', { catCode: cat.code, date: state.date, time, type: fixedType, stateCodes, memo });
    renderExcretionTypeSection(host, cat, state, refreshCalendar, fixedType);
    if (refreshCalendar) refreshCalendar();
  });
}

// ===== メモ（時間単位のメモのみ） =====
async function renderMemoSection(host, cat, state, refreshCalendar) {
  const entries = (await getByIndex('memoLog', 'byCatDate', [cat.code, state.date])).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const rowsHtml = entries.map(e => `<tr>
    <td>${escapeHtml(e.time)}</td>
    <td>${escapeHtml(e.memo || '-')}</td>
    <td><button class="btn-tiny danger" data-del-memo="${e.id}">削除</button></td>
  </tr>`).join('');

  host.innerHTML = `
    <div class="card">
      <div class="card-title">メモ</div>
      <table class="tbl"><thead><tr><th>時刻</th><th>メモ</th><th></th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="3" class="muted">この日はまだ記録がありません</td></tr>'}</tbody></table>
      <div class="feed-form">
        <div class="field"><label>時刻（10分単位に切り捨て）</label><input id="memoTime" type="time" step="600" value="${floorToTenMinutes(nowTimeStr())}"></div>
        <div class="field"><label>メモ</label><input id="memoText"></div>
        <button id="memoSave" class="btn-primary">入力確定</button>
      </div>
    </div>
  `;

  const timeInput = host.querySelector('#memoTime');
  timeInput.addEventListener('change', () => { timeInput.value = floorToTenMinutes(timeInput.value); });

  host.querySelectorAll('[data-del-memo]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('この記録を削除しますか？')) return;
    await remove('memoLog', Number(btn.dataset.delMemo));
    renderMemoSection(host, cat, state, refreshCalendar);
    if (refreshCalendar) refreshCalendar();
  }));

  const saveBtn = host.querySelector('#memoSave');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const time = floorToTenMinutes(timeInput.value);
    if (!time) { alert('時刻を入力してください'); return; }
    const memo = host.querySelector('#memoText').value;
    if (!memo) { alert('メモを入力してください'); return; }
    await put('memoLog', { catCode: cat.code, date: state.date, time, memo });
    renderMemoSection(host, cat, state, refreshCalendar);
    if (refreshCalendar) refreshCalendar();
  });
}

// ===== 日々管理 =====
async function renderDailySection(host, cat, state, refreshCalendar) {
  const rows = await getByIndex('dailyLog', 'byCatDate', [cat.code, state.date]);
  const existing = rows[0] || null;
  const events = (await getByIndex('codeMaster', 'byCategory', DAILY_EVENT_CATEGORY)).filter(e => e.code !== '');
  const existingEvents = (existing && existing.events) || [];
  const isInvalidDay = !!(existing && existing.invalid);

  const eventChecksHtml = events.map(e => {
    const checked = existingEvents.includes(e.code) ? 'checked' : '';
    return `<label class="chk"><input type="checkbox" class="daily-event-chk" value="${escapeHtml(e.code)}" ${checked}> ${escapeHtml(e.name)}</label>`;
  }).join('');

  host.innerHTML = `
    <div class="card">
      <div class="card-title">日々管理</div>
      <label class="invalid-day-toggle"><input type="checkbox" id="invalidDayChk" ${isInvalidDay ? 'checked' : ''}> この日は記録なし（データ無効）にする</label>
      <div class="field"><label>体重(kg)</label><input id="dailyWeight" type="number" step="0.01" value="${existing && existing.weight != null ? existing.weight : ''}"></div>
      <div class="field"><label>尿量(ml)</label><input id="dailyUrine" type="number" step="1" value="${existing && existing.urineAmount != null ? existing.urineAmount : ''}"></div>
      <div class="field"><label>イベント</label><div class="chk-list">${eventChecksHtml || '<span class="muted">コードマスタの「日々のイベント」にコードを追加してください</span>'}</div></div>
      <div class="field"><label>メモ</label><input id="dailyMemo" value="${existing && existing.memo ? escapeHtml(existing.memo) : ''}"></div>
      <button id="dailySave" class="btn-primary">保存</button>
    </div>
  `;

  host.querySelector('#invalidDayChk').addEventListener('change', async (ev) => {
    const currentRows = await getByIndex('dailyLog', 'byCatDate', [cat.code, state.date]);
    const currentExisting = currentRows[0] || null;
    const data = currentExisting ? { ...currentExisting } : { catCode: cat.code, date: state.date };
    data.invalid = ev.target.checked;
    await put('dailyLog', data);
    if (refreshCalendar) await refreshCalendar();
  });

  host.querySelector('#dailySave').addEventListener('click', async () => {
    const weightVal = host.querySelector('#dailyWeight').value;
    const urineVal = host.querySelector('#dailyUrine').value;
    const memoVal = host.querySelector('#dailyMemo').value;
    const selectedEvents = Array.from(host.querySelectorAll('.daily-event-chk:checked')).map(c => c.value);
    // invalidフラグは他の操作(記録なしトグル)で更新されている可能性があるため直前に再取得する
    const freshRows = await getByIndex('dailyLog', 'byCatDate', [cat.code, state.date]);
    const freshExisting = freshRows[0] || null;
    const data = {
      catCode: cat.code,
      date: state.date,
      weight: weightVal === '' ? null : Number(weightVal),
      urineAmount: urineVal === '' ? null : Number(urineVal),
      events: selectedEvents,
      memo: memoVal,
      invalid: freshExisting ? !!freshExisting.invalid : false
    };
    if (freshExisting) data.id = freshExisting.id;
    await put('dailyLog', data);
    alert('保存しました');
    renderDailySection(host, cat, state, refreshCalendar);
    if (refreshCalendar) refreshCalendar();
  });
}

// ===== カレンダー =====
async function renderCalendarSection(host, cat, state, container) {
  const feedRows = await getByIndex('feedingLog', 'byCat', cat.code);
  const dailyRows = await getByIndex('dailyLog', 'byCat', cat.code);
  const medicineRows = await getByIndex('medicineLog', 'byCat', cat.code);
  const excretionRows = await getByIndex('excretionLog', 'byCat', cat.code);
  const memoRows = await getByIndex('memoLog', 'byCat', cat.code);
  const markedDates = new Set([
    ...feedRows.map(r => r.date),
    ...dailyRows.map(r => r.date),
    ...medicineRows.map(r => r.date),
    ...excretionRows.map(r => r.date),
    ...memoRows.map(r => r.date)
  ]);
  const invalidDates = new Set(dailyRows.filter(r => r.invalid).map(r => r.date));

  const y = state.calendarMonth.getFullYear();
  const m = state.calendarMonth.getMonth();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  const startWeekday = firstDay.getDay();

  let cells = '';
  for (let i = 0; i < startWeekday; i++) cells += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateObj = new Date(y, m, d);
    const dateStr = formatDate(dateObj);
    const isInvalid = invalidDates.has(dateStr);
    const marked = !isInvalid && markedDates.has(dateStr) ? 'marked' : '';
    const invalidClass = isInvalid ? 'invalid-day' : '';
    const selected = dateStr === state.date ? 'selected' : '';
    const isToday = dateStr === todayStr() ? 'is-today' : '';
    const marker = isInvalid ? '<span class="dot invalid-dot">×</span>' : (marked ? '<span class="dot"></span>' : '');
    cells += `<div class="cal-cell ${marked} ${invalidClass} ${selected} ${isToday}" data-date="${dateStr}" title="${isInvalid ? '記録なしの日' : ''}">${d}${marker}</div>`;
  }

  host.innerHTML = `
    <div class="card">
      <div class="card-title cal-nav">
        <button id="prevMonth" class="btn-tiny">＜</button>
        <span>${y}年${m + 1}月</span>
        <button id="nextMonth" class="btn-tiny">＞</button>
      </div>
      <div class="cal-grid cal-weekday">
        <div>日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div>土</div>
      </div>
      <div class="cal-grid">${cells}</div>
    </div>
  `;

  host.querySelector('#prevMonth').addEventListener('click', () => {
    state.calendarMonth = new Date(y, m - 1, 1);
    renderCatTab(container, cat.code);
  });
  host.querySelector('#nextMonth').addEventListener('click', () => {
    state.calendarMonth = new Date(y, m + 1, 1);
    renderCatTab(container, cat.code);
  });
  host.querySelectorAll('[data-date]').forEach(cell => cell.addEventListener('click', () => {
    state.date = cell.dataset.date;
    renderCatTab(container, cat.code);
  }));
}

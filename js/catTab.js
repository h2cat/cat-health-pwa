import { get, put, remove, getByIndex } from './db.js';
import { escapeHtml, todayStr, formatDate, calcCalorie } from './utils.js';

const stateMap = {}; // catCode -> { date, calendarMonth (Date) }

function getState(catCode) {
  if (!stateMap[catCode]) {
    const today = new Date();
    stateMap[catCode] = { date: todayStr(), calendarMonth: new Date(today.getFullYear(), today.getMonth(), 1) };
  }
  return stateMap[catCode];
}

export async function renderCatTab(container, catCode) {
  const cat = await get('catMaster', catCode);
  if (!cat) { container.innerHTML = '<p>猫データが見つかりません</p>'; return; }
  const state = getState(catCode);

  container.innerHTML = `
    <div class="cat-header">
      <h2>${escapeHtml(cat.name)}</h2>
      <div class="date-bar">
        <span id="selDate" class="sel-date">${escapeHtml(state.date)}</span>
        ${state.date !== todayStr() ? '<button id="backToday" class="btn-tiny">今日に戻る</button>' : ''}
      </div>
    </div>
    <div id="feedingSection"></div>
    <div id="dailySection"></div>
    <div id="calendarSection"></div>
  `;

  const backBtn = container.querySelector('#backToday');
  if (backBtn) backBtn.addEventListener('click', () => {
    state.date = todayStr();
    renderCatTab(container, catCode);
  });

  await renderFeedingSection(container.querySelector('#feedingSection'), cat, state);
  await renderDailySection(container.querySelector('#dailySection'), cat, state);
  await renderCalendarSection(container.querySelector('#calendarSection'), cat, state, container);
}

// ===== 給餌管理 =====
async function renderFeedingSection(host, cat, state) {
  const { getAll } = await import('./db.js');
  const allFoods = await getAll('foodMaster');
  const candidateCodes = (cat.foodCandidates && cat.foodCandidates.length > 0) ? cat.foodCandidates : allFoods.map(f => f.code);
  const candidates = allFoods.filter(f => candidateCodes.includes(f.code));

  const entries = (await getByIndex('feedingLog', 'byCatDate', [cat.code, state.date])).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const totalCal = Math.round(entries.reduce((s, e) => s + (e.calorie || 0), 0) * 10) / 10;

  const foodOptions = candidates.map(f => `<option value="${escapeHtml(f.code)}">${escapeHtml(f.name)}</option>`).join('');

  let rowsHtml = entries.map(e => {
    const f = allFoods.find(x => x.code === e.foodCode);
    return `<tr>
      <td>${escapeHtml(e.time)}</td>
      <td>${escapeHtml(f ? f.name : e.foodCode)}</td>
      <td>${escapeHtml(e.providedAmount)}g</td>
      <td>${escapeHtml(e.eatenAmount)}g</td>
      <td>${escapeHtml(e.calorie)}kcal</td>
      <td><button class="btn-tiny danger" data-del-feed="${e.id}">削除</button></td>
    </tr>`;
  }).join('');

  host.innerHTML = `
    <div class="card">
      <div class="card-title">給餌管理</div>
      <table class="tbl"><thead><tr><th>時刻</th><th>餌</th><th>提供量</th><th>摂取量</th><th>カロリー</th><th></th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="6" class="muted">この日はまだ記録がありません</td></tr>'}</tbody></table>
      <div class="total-cal">合計カロリー: ${totalCal} kcal</div>
      <div class="feed-form">
        <div class="field"><label>時刻</label><input id="feedTime" type="time" value="${nowTimeStr()}"></div>
        <div class="field"><label>餌</label><select id="feedFood">${candidates.length ? foodOptions : '<option value="">餌が未登録です</option>'}</select></div>
        <div class="field"><label>提供量(g)</label><input id="feedProvided" type="number" step="0.1"></div>
        <div class="field"><label>摂取量(g)</label><input id="feedEaten" type="number" step="0.1"></div>
        <button id="feedSave" class="btn-primary">入力確定</button>
      </div>
    </div>
  `;

  const foodSelect = host.querySelector('#feedFood');
  const providedInput = host.querySelector('#feedProvided');
  function applyDefault() {
    const f = candidates.find(x => x.code === foodSelect.value);
    if (f && f.defaultAmountG) providedInput.value = f.defaultAmountG;
  }
  if (foodSelect) {
    foodSelect.addEventListener('change', applyDefault);
    applyDefault();
  }

  host.querySelectorAll('[data-del-feed]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('この記録を削除しますか？')) return;
    await remove('feedingLog', Number(btn.dataset.delFeed));
    renderFeedingSection(host, cat, state);
  }));

  const saveBtn = host.querySelector('#feedSave');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const foodCode = foodSelect.value;
    if (!foodCode) { alert('餌を選択してください'); return; }
    const food = allFoods.find(f => f.code === foodCode);
    const time = host.querySelector('#feedTime').value;
    const provided = Number(providedInput.value) || 0;
    const eaten = Number(host.querySelector('#feedEaten').value) || 0;
    if (!time) { alert('時刻を入力してください'); return; }
    const calorie = calcCalorie(food ? food.caloriePer100g : 0, eaten);
    await put('feedingLog', { catCode: cat.code, date: state.date, time, foodCode, providedAmount: provided, eatenAmount: eaten, calorie });
    renderFeedingSection(host, cat, state);
  });
}

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ===== 日々管理 =====
async function renderDailySection(host, cat, state) {
  const rows = await getByIndex('dailyLog', 'byCatDate', [cat.code, state.date]);
  const existing = rows[0] || null;

  host.innerHTML = `
    <div class="card">
      <div class="card-title">日々管理</div>
      <div class="field"><label>体重(kg)</label><input id="dailyWeight" type="number" step="0.01" value="${existing && existing.weight != null ? existing.weight : ''}"></div>
      <div class="field"><label>尿量(ml)</label><input id="dailyUrine" type="number" step="1" value="${existing && existing.urineAmount != null ? existing.urineAmount : ''}"></div>
      <div class="field"><label>メモ</label><input id="dailyMemo" value="${existing && existing.memo ? escapeHtml(existing.memo) : ''}"></div>
      <button id="dailySave" class="btn-primary">保存</button>
    </div>
  `;
  host.querySelector('#dailySave').addEventListener('click', async () => {
    const weightVal = host.querySelector('#dailyWeight').value;
    const urineVal = host.querySelector('#dailyUrine').value;
    const memoVal = host.querySelector('#dailyMemo').value;
    const data = {
      catCode: cat.code,
      date: state.date,
      weight: weightVal === '' ? null : Number(weightVal),
      urineAmount: urineVal === '' ? null : Number(urineVal),
      memo: memoVal
    };
    if (existing) data.id = existing.id;
    await put('dailyLog', data);
    alert('保存しました');
    renderDailySection(host, cat, state);
  });
}

// ===== カレンダー =====
async function renderCalendarSection(host, cat, state, container) {
  const feedRows = await getByIndex('feedingLog', 'byCat', cat.code);
  const dailyRows = await getByIndex('dailyLog', 'byCat', cat.code);
  const markedDates = new Set([...feedRows.map(r => r.date), ...dailyRows.map(r => r.date)]);

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
    const marked = markedDates.has(dateStr) ? 'marked' : '';
    const selected = dateStr === state.date ? 'selected' : '';
    const isToday = dateStr === todayStr() ? 'is-today' : '';
    cells += `<div class="cal-cell ${marked} ${selected} ${isToday}" data-date="${dateStr}">${d}${marked ? '<span class="dot"></span>' : ''}</div>`;
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

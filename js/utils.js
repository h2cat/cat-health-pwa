// 共通ユーティリティ
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function todayStr() {
  return formatDate(new Date());
}

export function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// "YYYY-MM-DD" に days日を加減算した日付文字列を返す
export function addDaysStr(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return formatDate(dt);
}

export function el(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html.trim();
  return tmp.firstElementChild;
}

export function calcCalorie(caloriePer100g, gramsEaten) {
  const c = Number(caloriePer100g) || 0;
  const g = Number(gramsEaten) || 0;
  return Math.round((c / 100) * g * 10) / 10;
}

// 餌マスタのカロリー入力を100gあたりのkcalに変換する。
// "75/85" のような "kcal/内容量g" 形式なら (75/85)*100 に換算し、
// 単純な数値ならそのまま100gあたりの値として扱う。
export function parseCaloriePer100gInput(str) {
  if (str === null || str === undefined) return 0;
  const trimmed = String(str).trim();
  if (!trimmed) return 0;
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    const kcal = Number(parts[0]);
    const grams = Number(parts[1]);
    if (!kcal || !grams) return 0;
    return Math.round((kcal / grams) * 100 * 100) / 100;
  }
  return Number(trimmed) || 0;
}

// "HH:MM" を10分単位に切り捨てる（例: 14:37 → 14:30）
export function floorToTenMinutes(timeStr) {
  if (!timeStr) return timeStr;
  const m = timeStr.match(/^(\d{1,2}):(\d{1,2})/);
  if (!m) return timeStr;
  const h = String(m[1]).padStart(2, '0');
  const min = String(Math.floor(Number(m[2]) / 10) * 10).padStart(2, '0');
  return `${h}:${min}`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// "HH:MM" を "HHMM" に変換する（例: 14:30 → 1430）
export function timeToHHMM(timeStr) {
  if (!timeStr) return '';
  return timeStr.replace(':', '');
}

// 内部保存用の時刻文字列を表示用に正規化する。
// ソート順を保つために24時以降の延長表記（26:00など、日をまたいだ深夜の記録）や
// 時刻不明の「夜間」を表す擬似時刻（99:00など、90時以降）を使うことがあるため、
// 表示時はここで通常の時刻表記や「夜間」ラベルに変換する。
// 例: "26:00" → "02:00" ／ "99:00" → "夜間" ／ "14:30" → "14:30"（そのまま）
export function formatDisplayTime(timeStr) {
  if (!timeStr) return '';
  const m = String(timeStr).match(/^(\d{1,3}):(\d{1,2})$/);
  if (!m) return timeStr;
  let h = Number(m[1]);
  const min = String(m[2]).padStart(2, '0');
  if (h >= 90) return '夜間';
  if (h >= 24) h -= 24;
  return `${String(h).padStart(2, '0')}:${min}`;
}

// マスタ行から表示用の略称を取得（未設定なら名称、なければ空文字）
export function abbrOrName(entity) {
  if (!entity) return '';
  return entity.abbr || entity.name || '';
}

// メモの有無をアイコン(💬)＋ツールチップのHTMLにする。メモが無ければ空文字。
export function memoFlagHtml(memo) {
  if (!memo) return '';
  return `<span class="memo-flag" title="${escapeHtml(memo)}">💬</span>`;
}

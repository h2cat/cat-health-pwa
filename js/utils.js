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

// 「1日の区切りは朝6時」ルールに基づく論理上の今日の日付を返す。
// 実時刻が00:00〜05:59の間は、まだ前日の続き（深夜）として扱い、前日の日付を返す。
// 例: 実時刻が08/23 01:20 なら 08/22 を返す。カレンダーのアクティブ日や
// 「今日に戻る」ボタンの遷移先など、アプリの「今日」の基準として使う。
export function logicalTodayStr() {
  const now = new Date();
  if (now.getHours() < 6) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return formatDate(d);
  }
  return formatDate(now);
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

// ログ保存時の時刻正規化。「1日は朝6時始まり」ルールに基づき、
// 入力された時刻が00:00〜05:59（深夜〜早朝）の場合は、その日の続きとして
// ソート順を保つために24を足した延長表記（例: 01:20 → 25:20）で保存する。
// 06:00以降の通常時刻はそのまま返す。
export function normalizeEntryTime(timeStr) {
  if (!timeStr) return timeStr;
  const m = timeStr.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return timeStr;
  const h = Number(m[1]);
  const min = String(m[2]).padStart(2, '0');
  if (h >= 0 && h < 6) {
    return `${h + 24}:${min}`;
  }
  return `${String(h).padStart(2, '0')}:${min}`;
}

// クイック選択用の時刻候補。「1日は朝6時始まり」ルールに合わせ、
// 06時〜23時→24時（深夜0時）→01時〜05時（深夜1〜5時）の順で並べる。
export function quickTimeHourOptions() {
  const hours = [];
  for (let h = 6; h <= 23; h++) hours.push(String(h).padStart(2, '0'));
  hours.push('24');
  for (let h = 1; h <= 5; h++) hours.push(String(h).padStart(2, '0'));
  return hours;
}

// クイック選択用の分候補（10分刻み）
export function quickTimeMinuteOptions() {
  return ['00', '10', '20', '30', '40', '50'];
}

// 実時刻または表示用時刻文字列("HH:MM"、通常の0-23時表記)から、
// クイック選択の初期値に一番近い{hour, min}を返す。
// 深夜0時台（実時刻00:xx）は延長時刻表記に合わせて hour="24" を返す。
export function nearestQuickTime(hhmm) {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return { hour: '06', min: '00' };
  const realHour = Number(m[1]);
  const min = String(Math.floor(Number(m[2]) / 10) * 10).padStart(2, '0');
  const hour = realHour === 0 ? '24' : String(realHour).padStart(2, '0');
  return { hour, min };
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

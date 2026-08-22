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

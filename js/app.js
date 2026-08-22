import { openDB, getAll } from './db.js';
import { seedDefaults, renderDashboard } from './dashboard.js';
import { renderCatTab } from './catTab.js';

const tabBar = document.getElementById('tabBar');
const tabContent = document.getElementById('tabContent');
const updateBtn = document.getElementById('updateBtn');
let activeTab = 'dashboard';

async function init() {
  await openDB();
  await seedDefaults();
  await renderTabBar();
  await showTab(activeTab);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

  if (updateBtn) updateBtn.addEventListener('click', forceUpdate);
}

// キャッシュ・Service Workerを完全にクリアしてから再読み込みする。
// JSを更新してもiPhone等で古いキャッシュがなかなか消えないため、手動で強制更新できるようにしたもの。
async function forceUpdate() {
  if (!confirm('最新版を確認して読み込み直します。よろしいですか？')) return;
  updateBtn.disabled = true;
  updateBtn.textContent = '更新中…';
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch (e) {
    // キャッシュ削除に失敗しても、とにかくリロードは試みる
  }
  location.reload();
}

async function renderTabBar() {
  const cats = await getAll('catMaster');
  let html = `<button class="tab-btn" data-tab="dashboard">設定</button>`;
  cats.forEach(cat => {
    html += `<button class="tab-btn" data-tab="cat:${cat.code}">${escapeTab(cat.name)}</button>`;
  });
  tabBar.innerHTML = html;
  tabBar.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      showTab(activeTab);
    });
  });

  if (activeTab.startsWith('cat:')) {
    const stillExists = cats.some(c => `cat:${c.code}` === activeTab);
    if (!stillExists) {
      activeTab = 'dashboard';
      await showTab(activeTab);
      return;
    }
  }
  markActive();
}

function escapeTab(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function markActive() {
  tabBar.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === activeTab);
  });
}

async function showTab(tab) {
  markActive();
  if (tab === 'dashboard') {
    await renderDashboard(tabContent, { onCatsChanged: renderTabBar });
  } else if (tab.startsWith('cat:')) {
    const catCode = tab.slice(4);
    await renderCatTab(tabContent, catCode);
  }
}

init();

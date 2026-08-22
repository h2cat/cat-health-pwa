import { openDB, getAll } from './db.js';
import { seedDefaults, renderDashboard } from './dashboard.js';
import { renderCatTab } from './catTab.js';

const tabBar = document.getElementById('tabBar');
const tabContent = document.getElementById('tabContent');
let activeTab = 'dashboard';

async function init() {
  await openDB();
  await seedDefaults();
  await renderTabBar();
  await showTab(activeTab);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
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

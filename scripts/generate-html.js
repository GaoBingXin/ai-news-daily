const fs = require('fs').promises;
const path = require('path');

const INLINE_DAYS = 3;

async function generateHTML() {
  const dataDir = path.join(__dirname, '../data');
  const publicDir = path.join(__dirname, '../public');

  const latestPath = path.join(dataDir, 'latest.json');
  const latestData = JSON.parse(await fs.readFile(latestPath, 'utf-8'));

  const files = await fs.readdir(dataDir);

  // ── AI 资讯（按日期） ──
  const newsFiles = files.filter(f => f.startsWith('news-') && f.endsWith('.json'));
  const allDates = newsFiles.map(f => f.replace('news-', '').replace('.json', '')).sort();
  const recentNewsDates = allDates.slice(-INLINE_DAYS);
  const olderNewsDates = allDates.slice(0, -INLINE_DAYS);

  const filterPureEnglish = news => news.filter(item => (item.title.match(/[\u4e00-\u9fa5]/g) || []).length > 0);

  const inlineNewsData = {};
  for (const date of recentNewsDates) {
    try {
      const data = JSON.parse(await fs.readFile(path.join(dataDir, 'news-' + date + '.json'), 'utf-8'));
      inlineNewsData[date] = { ...data, count: filterPureEnglish(data.news).length, news: filterPureEnglish(data.news) };
    } catch (e) { console.log('Error loading news', date, e.message); }
  }
  for (const date of olderNewsDates) {
    try {
      const data = JSON.parse(await fs.readFile(path.join(dataDir, 'news-' + date + '.json'), 'utf-8'));
      const filtered = { ...data, count: filterPureEnglish(data.news).length, news: filterPureEnglish(data.news) };
      await fs.writeFile(path.join(publicDir, 'news-' + date + '.json'), JSON.stringify(filtered));
    } catch (e) { console.log('Error writing news', date, e.message); }
  }

  // ── GitHub 热榜 ──
  let githubTrending = null;
  try { githubTrending = JSON.parse(await fs.readFile(path.join(dataDir, 'github-trending.json'), 'utf-8')); } catch (e) {}

  // ── 自定义分类 ──
  let customCategories = [];
  try { customCategories = JSON.parse(await fs.readFile(path.join(dataDir, 'custom-categories.json'), 'utf-8')); } catch (e) {}

  const customFiles = files.filter(f => f.startsWith('custom-data-') && f.endsWith('.json'));
  const customDates = customFiles.map(f => f.replace('custom-data-', '').replace('.json', '')).sort();
  const recentCustomDates = customDates.slice(-INLINE_DAYS);
  const olderCustomDates = customDates.slice(0, -INLINE_DAYS);

  const inlineCustomData = {};
  for (const date of recentCustomDates) {
    try {
      inlineCustomData[date] = JSON.parse(await fs.readFile(path.join(dataDir, 'custom-data-' + date + '.json'), 'utf-8'));
    } catch (e) { console.log('Error loading custom', date, e.message); }
  }
  for (const date of olderCustomDates) {
    try {
      const data = JSON.parse(await fs.readFile(path.join(dataDir, 'custom-data-' + date + '.json'), 'utf-8'));
      await fs.writeFile(path.join(publicDir, 'custom-data-' + date + '.json'), JSON.stringify(data));
    } catch (e) { console.log('Error writing custom', date, e.message); }
  }

  // fallback: 如果没有任何 custom-data-*.json 但有 custom-data.json，用它作为今日数据
  if (customDates.length === 0) {
    try {
      const fallback = JSON.parse(await fs.readFile(path.join(dataDir, 'custom-data.json'), 'utf-8'));
      if (fallback.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        customDates.push(today);
        recentCustomDates.push(today);
        inlineCustomData[today] = fallback;
      }
    } catch (e) {}
  }

  const html = buildHTML({
    inlineNewsData, allDates, githubTrending,
    customCategories, inlineCustomData, customDates,
  });
  await fs.writeFile(path.join(publicDir, 'index.html'), html);
  console.log('✅ HTML生成完成');
}

// ════════════════════════════════════════════════════════════════
// HTML 模板
// ════════════════════════════════════════════════════════════════

function buildHTML({ inlineNewsData, allDates, githubTrending, customCategories, inlineCustomData, customDates }) {
  const customTabsHTML = customCategories.map(cat =>
    '<button class="nav-tab custom-tab" data-tab="custom-' + cat.id + '">' + cat.name + '</button>'
  ).join('');

  // 自定义分类面板 —— 仅渲染容器，内容由 JS 根据日期动态填充
  const customPanelsHTML = customCategories.map(cat => {
    return '<div id="panel-custom-' + cat.id + '" class="tab-panel">' +
      '<div class="panel-toolbar">' +
        '<div class="date-picker">' +
          '<button class="date-btn date-prev" data-cat="' + cat.id + '">&#8249;</button>' +
          '<select class="date-select" data-cat="' + cat.id + '"></select>' +
          '<button class="date-btn date-next" data-cat="' + cat.id + '">&#8250;</button>' +
        '</div>' +
        '<div class="panel-stats" id="customStats-' + cat.id + '"></div>' +
        '<button class="delete-cat-btn" data-cat-id="' + cat.id + '" data-cat-name="' + cat.name + '" title="删除此栏目">删除栏目</button>' +
      '</div>' +
      '<div class="panel-content" id="customContent-' + cat.id + '"></div>' +
    '</div>';
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>智汇日报</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📰</text></svg>">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --primary-light: #eff6ff;
  --accent-green: #059669;
  --accent-green-light: #ecfdf5;
  --accent-orange: #d97706;
  --accent-orange-light: #fffbeb;
  --accent-purple: #7c3aed;
  --bg: #edf0f5;
  --card: #ffffff;
  --text: #1a202c;
  --text-secondary: #718096;
  --text-muted: #a0aec0;
  --border: #e2e8f0;
  --border-light: #edf2f7;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03);
  --shadow-md: 0 4px 14px rgba(0,0,0,0.08);
  --radius: 12px;
  --radius-sm: 8px;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  line-height: 1.6;
}

/* ── Header ── */
.site-header {
  background: var(--card);
  border-top: 3px solid var(--primary);
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  position: sticky;
  top: 0;
  z-index: 100;
}
.header-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px 24px 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.brand-icon { font-size: 1.6rem; }
.brand-name {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}
.brand-desc {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid var(--border);
}

/* ── Nav Tabs ── */
.nav-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 12px;
}
.nav-tabs::-webkit-scrollbar { display: none; }
.nav-tab {
  padding: 8px 18px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.nav-tab:hover { color: var(--text); background: var(--bg); }
.nav-tab.active {
  color: var(--primary);
  background: var(--primary-light);
  font-weight: 600;
}
.add-tab {
  width: 34px;
  padding: 8px 0;
  font-size: 1.15rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  border-radius: 50%;
}
.add-tab:hover { color: var(--primary); background: var(--primary-light); }

/* ── Main Container ── */
.main { max-width: 1100px; margin: 0 auto; padding: 24px 24px 48px; }

/* ── Tab Panels ── */
.tab-panel { display: none; }
.tab-panel.active { display: block; }

/* ── Panel Toolbar (date picker + stats) ── */
.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
  background: linear-gradient(135deg, #f0f5ff 0%, #f5f0ff 100%);
  padding: 14px 20px;
  border-radius: var(--radius);
  border: 1px solid #dce3f0;
}
.date-picker { display: flex; align-items: center; gap: 6px; }
.date-select {
  padding: 7px 14px;
  font-size: 0.9rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card);
  color: var(--text);
  cursor: pointer;
  outline: none;
}
.date-select:focus { border-color: var(--primary); }
.date-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.date-btn:hover:not(:disabled) { background: var(--primary-light); color: var(--primary); }
.date-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.panel-stats {
  display: flex;
  gap: 16px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.stat-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  background: var(--primary-light);
  color: var(--primary);
  padding: 5px 12px;
  border-radius: 20px;
  font-weight: 500;
  font-size: 0.82rem;
}
.stat-chip.green { background: var(--accent-green-light); color: var(--accent-green); }
.stat-chip.orange { background: var(--accent-orange-light); color: var(--accent-orange); }

/* ── Delete Button ── */
.delete-cat-btn {
  padding: 5px 12px;
  font-size: 0.78rem;
  font-weight: 500;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  margin-left: auto;
}
.delete-cat-btn:hover { background: #fee2e2; border-color: #fca5a5; }

/* ── Category Cards ── */
.category-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-left: 4px solid var(--primary);
  border-radius: 4px var(--radius) var(--radius) 4px;
  padding: 20px 24px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
}
.category-card:nth-child(4n+2) { border-left-color: var(--accent-green); }
.category-card:nth-child(4n+3) { border-left-color: var(--accent-orange); }
.category-card:nth-child(4n+4) { border-left-color: var(--accent-purple); }
.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}
.category-icon { font-size: 1.15rem; }
.category-title { font-size: 1.05rem; font-weight: 600; color: var(--text); }
.category-count {
  margin-left: auto;
  font-size: 0.78rem;
  color: var(--text-muted);
  background: var(--bg);
  padding: 3px 10px;
  border-radius: 12px;
}

/* ── News Items ── */
.news-list { display: flex; flex-direction: column; }
.news-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-light);
}
.news-item:last-child { border-bottom: none; }
.news-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
  margin-top: 9px;
  flex-shrink: 0;
}
.news-body { flex: 1; min-width: 0; }
.news-title {
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.5;
  margin-bottom: 4px;
}
.news-title a {
  color: var(--text);
  text-decoration: none;
  transition: color 0.15s;
}
.news-title a:hover { color: var(--primary); }
.news-meta {
  display: flex;
  gap: 12px;
  font-size: 0.78rem;
  color: var(--text-muted);
  align-items: center;
}
.news-source {
  background: var(--primary);
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
}

/* ── GitHub Section ── */
.github-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #f0f5ff 0%, #f5f0ff 100%);
  padding: 5px;
  border-radius: var(--radius-sm);
  border: 1px solid #dce3f0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.gh-tab {
  padding: 8px 14px;
  font-size: 0.82rem;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.gh-tab:hover { color: var(--text); background: var(--card); }
.gh-tab.active {
  background: var(--card);
  color: var(--primary);
  box-shadow: var(--shadow-sm);
}
.gh-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 8px;
}
.gh-title { font-size: 1.1rem; font-weight: 700; color: var(--text); }
.gh-date { font-size: 0.8rem; color: var(--text-muted); }

/* ── Repo Cards ── */
.repo-grid { display: flex; flex-direction: column; gap: 12px; }
.repo-card {
  display: flex;
  gap: 14px;
  background: var(--card);
  padding: 16px 20px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.2s, transform 0.2s;
}
.repo-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.repo-rank {
  font-size: 1rem;
  font-weight: 700;
  color: var(--primary);
  min-width: 32px;
  display: flex;
  align-items: flex-start;
  padding-top: 2px;
}
.repo-info { flex: 1; min-width: 0; }
.repo-name { font-size: 0.95rem; font-weight: 600; margin-bottom: 4px; }
.repo-name a { color: var(--text); text-decoration: none; }
.repo-name a:hover { color: var(--primary); }
.repo-desc {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin-bottom: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.repo-stats { display: flex; gap: 14px; font-size: 0.78rem; color: var(--text-muted); flex-wrap: wrap; }
.repo-stat { display: flex; align-items: center; gap: 4px; }
.lang-dot { width: 10px; height: 10px; border-radius: 50%; }
.growth-badge {
  background: #fee2e2;
  color: #dc2626;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
}

/* ── Empty / Loading State ── */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
}
.empty-state h2 { font-size: 1.1rem; font-weight: 500; color: var(--text-secondary); }
.custom-empty-news {
  text-align: left;
  max-width: 36rem;
  margin: 0 auto;
  padding: 20px 24px;
  color: var(--text-secondary);
  line-height: 1.65;
  font-size: 0.9rem;
  background: var(--card);
  border-radius: var(--radius);
  border: 1px solid var(--border);
}
.custom-empty-news p { margin-bottom: 8px; }
.custom-empty-news p:last-child { margin-bottom: 0; }
.custom-empty-hint { font-size: 0.82rem; color: var(--text-muted); }

/* ── Modal ── */
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  z-index: 1000;
  align-items: center;
  justify-content: center;
}
.modal-overlay.active { display: flex; }
.modal {
  background: var(--card);
  border-radius: 16px;
  padding: 28px 32px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  animation: modalIn 0.25s ease;
  max-height: 90vh;
  overflow-y: auto;
}
@keyframes modalIn {
  from { opacity: 0; transform: scale(0.95) translateY(12px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.modal-title { font-size: 1.15rem; font-weight: 700; margin-bottom: 20px; color: var(--text); }
.form-group { margin-bottom: 18px; }
.form-label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; color: var(--text); }
.form-input {
  width: 100%;
  padding: 10px 14px;
  font-size: 0.92rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  outline: none;
  transition: border-color 0.15s;
  background: var(--card);
  color: var(--text);
}
.form-input:focus { border-color: var(--primary); }
.form-hint { font-size: 0.78rem; color: var(--text-muted); margin-top: 5px; line-height: 1.5; }
.modal-actions { display: flex; gap: 10px; margin-top: 24px; }
.modal-btn {
  flex: 1;
  padding: 10px 20px;
  font-size: 0.92rem;
  font-weight: 600;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
}
.modal-btn-cancel { background: var(--bg); color: var(--text-secondary); border: 1px solid var(--border); }
.modal-btn-cancel:hover { background: var(--border-light); }
.modal-btn-submit { background: var(--primary); color: #fff; }
.modal-btn-submit:hover { background: var(--primary-hover); }

/* ── Collect Loading Overlay ── */
.collect-loading-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(6px);
  align-items: center;
  justify-content: center;
  flex-direction: column;
}
.collect-loading-overlay.show { display: flex; }
.collect-loading-inner { text-align: center; max-width: 20rem; padding: 1.5rem; }
.collect-spinner {
  width: 2.5rem;
  height: 2.5rem;
  margin: 0 auto;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.collect-loading-title { font-size: 1.05rem; font-weight: 700; margin: 1rem 0 0.4rem; color: var(--text); }
.collect-loading-desc { font-size: 0.88rem; color: var(--text-secondary); line-height: 1.55; }
.collect-loading-hint { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.7rem; line-height: 1.45; }

/* ── Footer ── */
.site-footer {
  text-align: center;
  padding: 32px 24px;
  color: var(--text-muted);
  font-size: 0.82rem;
  border-top: 1px solid var(--border);
  max-width: 1100px;
  margin: 0 auto;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .header-inner { padding: 12px 16px 0; }
  .brand-name { font-size: 1.15rem; }
  .brand-desc { display: none; }
  .nav-tab { padding: 10px 16px; font-size: 0.85rem; }
  .main { padding: 16px 16px 40px; }
  .panel-toolbar { flex-direction: column; align-items: flex-start; padding: 12px 16px; }
  .category-card { padding: 16px; }
  .repo-card { flex-direction: column; padding: 14px 16px; }
  .modal { padding: 24px; width: 95%; }
}
</style>
</head>
<body>

<header class="site-header">
  <div class="header-inner">
    <div class="brand">
      <span class="brand-icon">📰</span>
      <span class="brand-name">智汇日报</span>
      <span class="brand-desc">AI 资讯 · GitHub 热榜 · 自定义订阅</span>
    </div>
    <nav class="nav-tabs">
      <button class="nav-tab active" data-tab="news">AI资讯</button>
      <button class="nav-tab" data-tab="github">GitHub热榜</button>
      ` + customTabsHTML + `
      <button class="nav-tab add-tab" id="addCategoryBtn" title="添加自定义分类">+</button>
    </nav>
  </div>
</header>

<div class="main">

<!-- AI资讯 -->
<div id="panel-news" class="tab-panel active">
  <div class="panel-toolbar">
    <div class="date-picker">
      <button class="date-btn" id="prevBtn">&#8249;</button>
      <select class="date-select" id="dateSelect"></select>
      <button class="date-btn" id="nextBtn">&#8250;</button>
    </div>
    <div class="panel-stats" id="stats"></div>
  </div>
  <div id="newsContent"></div>
</div>

<!-- GitHub热榜 -->
<div id="panel-github" class="tab-panel">
  <div class="github-tabs">
    <button class="gh-tab active" data-list="trending">🔥 今日热榜</button>
    <button class="gh-tab" data-list="most-forked">🍴 Fork最多</button>
    <button class="gh-tab" data-list="new-this-month">🚀 本月新星</button>
    <button class="gh-tab" data-list="trending-growth">💥 飙升榜</button>
    <button class="gh-tab" data-list="chinese">🌍 中文项目</button>
    <button class="gh-tab" data-list="newest">⏰ 最新创建</button>
    <button class="gh-tab" data-list="oldest">📅 最老创建</button>
  </div>
  <div class="gh-header">
    <h2 class="gh-title" id="ghTitle">🔥 今日热榜</h2>
    <span class="gh-date" id="ghDate"></span>
  </div>
  <div id="repoGrid" class="repo-grid"></div>
</div>

<!-- 自定义分类面板 -->
` + customPanelsHTML + `

<footer class="site-footer">智汇日报 · 每日自动更新 · Powered by AI</footer>
</div>

<!-- 添加分类 Modal -->
<div class="modal-overlay" id="modalOverlay">
  <div class="modal">
    <h2 class="modal-title">添加自定义分类</h2>
    <div class="form-group">
      <label class="form-label">分类名称</label>
      <input type="text" class="form-input" id="categoryName" placeholder="例如：游戏、科技、数码">
    </div>
    <div class="form-group">
      <label class="form-label">关键词（用逗号分隔）</label>
      <input type="text" class="form-input" id="categoryKeywords" placeholder="例如：游戏, gaming, steam, 电子竞技">
      <p class="form-hint">系统会通过百度新闻、搜狗新闻、Google News 全网搜索这些关键词的最新资讯。建议同时填写中英文关键词。</p>
    </div>
    <div class="modal-actions">
      <button class="modal-btn modal-btn-cancel" id="cancelBtn">取消</button>
      <button class="modal-btn modal-btn-submit" id="submitBtn">添加并采集</button>
    </div>
  </div>
</div>

<div id="collectLoadingOverlay" class="collect-loading-overlay" aria-live="polite" aria-busy="false">
  <div class="collect-loading-inner">
    <div class="collect-spinner" role="status" aria-label="加载中"></div>
    <p class="collect-loading-title">正在采集</p>
    <p class="collect-loading-desc">正在通过搜索引擎全网采集相关资讯，请稍候…</p>
    <p class="collect-loading-hint">采集通常需 30 秒～1 分钟，请勿关闭本页；完成后会自动刷新。</p>
  </div>
</div>

<script>
// ── 数据 ──
const newsData = ` + JSON.stringify(inlineNewsData).replace(/</g, '\\u003c').replace(/>/g, '\\u003e') + `;
const newsDates = ` + JSON.stringify(allDates) + `;
const githubTrending = ` + (githubTrending ? JSON.stringify(githubTrending).replace(/</g, '\\u003c').replace(/>/g, '\\u003e') : 'null') + `;
const customCategories = ` + JSON.stringify(customCategories) + `;
const customDataByDate = ` + JSON.stringify(inlineCustomData).replace(/</g, '\\u003c').replace(/>/g, '\\u003e') + `;
const customDates = ` + JSON.stringify(customDates) + `;

const listConfig = {
  'trending': '🔥 今日热榜',
  'most-forked': '🍴 Fork最多',
  'new-this-month': '🚀 本月新星',
  'trending-growth': '💥 飙升榜',
  'chinese': '🌍 中文项目',
  'newest': '⏰ 最新创建',
  'oldest': '📅 最老创建'
};

// ── 工具函数 ──
function fmtDate(d) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) : ''; }
function fmtNum(n) { return n >= 1000 ? (n/1000).toFixed(1) + 'k' : String(n); }

// ── Tab 切换 ──
document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (!tab) return;
    const panel = document.getElementById('panel-' + tab);
    if (!panel) return;
    requestAnimationFrame(() => {
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      panel.classList.add('active');
    });
  });
});

// ════════════════════════════════
// AI 资讯
// ════════════════════════════════
const newsCache = Object.assign({}, newsData);
const iconMap = {"大模型":"🧠","OpenAI":"🚀","AI综合":"💡","国产大模型":"🇨🇳","AI Agent":"📌","AI图像":"🎨","AI视频":"🎬","研究":"🔬","Google":"🔍","Anthropic":"💬"};

function renderNewsHTML(newsByCategory) {
  if (!newsByCategory || Object.keys(newsByCategory).length === 0)
    return '<div class="empty-state"><h2>该日期暂无资讯</h2></div>';
  let html = '';
  for (const [category, items] of Object.entries(newsByCategory)) {
    const icon = iconMap[category] || '📌';
    html += '<div class="category-card"><div class="category-header"><span class="category-icon">' + icon + '</span><h2 class="category-title">' + category + '</h2><span class="category-count">' + items.length + ' 条</span></div><div class="news-list">';
    for (const item of items) {
      html += '<div class="news-item"><span class="news-dot"></span><div class="news-body"><h3 class="news-title"><a href="' + item.link + '" target="_blank" rel="noopener">' + item.title + '</a></h3><div class="news-meta"><span class="news-source">' + item.source + '</span><span>' + (item.date ? new Date(item.date).toLocaleDateString('zh-CN') : '') + '</span></div></div></div>';
    }
    html += '</div></div>';
  }
  return html;
}

function showNewsData(dateStr, data) {
  const newsByCategory = {};
  data.news.forEach(item => {
    const cat = item.category || '其他';
    if (!newsByCategory[cat]) newsByCategory[cat] = [];
    newsByCategory[cat].push(item);
  });
  document.getElementById('newsContent').innerHTML = renderNewsHTML(newsByCategory);
  document.getElementById('dateSelect').value = dateStr;
  const sourceCount = new Set(data.news.map(n => n.source)).size;
  document.getElementById('stats').innerHTML =
    '<span class="stat-chip">📰 ' + data.count + ' 条</span>' +
    '<span class="stat-chip green">🏷️ ' + Object.keys(newsByCategory).length + ' 分类</span>' +
    '<span class="stat-chip orange">📡 ' + sourceCount + ' 源</span>';
  const idx = newsDates.indexOf(dateStr);
  document.getElementById('prevBtn').disabled = idx === 0;
  document.getElementById('nextBtn').disabled = idx === newsDates.length - 1;
}

async function loadNewsDate(dateStr) {
  if (newsCache[dateStr]) { showNewsData(dateStr, newsCache[dateStr]); return; }
  document.getElementById('newsContent').innerHTML = '<div class="empty-state"><h2>加载中…</h2></div>';
  try {
    const resp = await fetch('/news-' + dateStr + '.json');
    if (resp.ok) { const d = await resp.json(); newsCache[dateStr] = d; showNewsData(dateStr, d); }
    else showNewsData(dateStr, { count: 0, news: [] });
  } catch { showNewsData(dateStr, { count: 0, news: [] }); }
}

const dateSelect = document.getElementById('dateSelect');
newsDates.forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = fmtDate(d); dateSelect.appendChild(o); });
dateSelect.addEventListener('change', e => loadNewsDate(e.target.value));
document.getElementById('prevBtn').addEventListener('click', () => loadNewsDate(newsDates[Math.max(0, newsDates.indexOf(dateSelect.value) - 1)]));
document.getElementById('nextBtn').addEventListener('click', () => loadNewsDate(newsDates[Math.min(newsDates.length - 1, newsDates.indexOf(dateSelect.value) + 1)]));
dateSelect.value = newsDates[newsDates.length - 1];
loadNewsDate(newsDates[newsDates.length - 1]);

// ════════════════════════════════
// GitHub 热榜
// ════════════════════════════════
const langColors = {'JavaScript':'#f1e05a','TypeScript':'#2b7489','Python':'#3572A5','Java':'#b07219','Go':'#00ADD8','Rust':'#dea584','C++':'#f34b7d','C':'#555555','Ruby':'#701516','PHP':'#4F5D95','Swift':'#F05138','Kotlin':'#A97BFF','Shell':'#89e051','HTML':'#e34c26','CSS':'#563d7c','Vue':'#41b883','C#':'#178600'};

function renderRepos(data, listKey) {
  if (!data || data.length === 0) return '<div class="empty-state"><h2>暂无数据</h2></div>';
  let html = '';
  data.forEach((repo, i) => {
    const lc = langColors[repo.language] || '#858585';
    html += '<div class="repo-card"><div class="repo-rank">#' + (i+1) + '</div><div class="repo-info"><div class="repo-name"><a href="' + repo.url + '" target="_blank" rel="noopener">' + repo.name + '</a>';
    if (listKey === 'trending-growth' && repo.starGrowth) html += ' <span class="growth-badge">↑ ' + repo.starGrowth + '/天</span>';
    html += '</div><div class="repo-desc">' + (repo.cn_description || repo.description || '暂无描述') + '</div><div class="repo-stats">';
    if (repo.language) html += '<span class="repo-stat"><span class="lang-dot" style="background:' + lc + '"></span>' + repo.language + '</span>';
    html += '<span class="repo-stat">⭐ ' + fmtNum(repo.stars) + '</span><span class="repo-stat">🍴 ' + fmtNum(repo.forks) + '</span>';
    if (repo.created_at) html += '<span class="repo-stat">📅 ' + new Date(repo.created_at).toLocaleDateString('zh-CN', {year:'numeric',month:'short',day:'numeric'}) + '</span>';
    html += '</div></div></div>';
  });
  return html;
}

let currentGHList = 'trending';
function loadGHList(key) {
  currentGHList = key;
  document.querySelectorAll('.gh-tab').forEach(b => b.classList.toggle('active', b.dataset.list === key));
  document.getElementById('ghTitle').textContent = listConfig[key] || key;
  let data = [];
  if (githubTrending?.lists?.[key]) data = [...githubTrending.lists[key]];
  document.getElementById('repoGrid').innerHTML = renderRepos(data, key);
}

if (githubTrending) {
  document.getElementById('ghDate').textContent = new Date(githubTrending.date).toLocaleDateString('zh-CN');
  loadGHList('trending');
  document.querySelectorAll('.gh-tab').forEach(btn => btn.addEventListener('click', () => loadGHList(btn.dataset.list)));
}

// ════════════════════════════════
// 自定义栏目 —— 日期切换
// ════════════════════════════════
const customCache = Object.assign({}, customDataByDate);

function renderCustomPanel(catId, dateStr, allCatData) {
  const catBlock = (allCatData || []).find(c => c.id === catId);
  const contentEl = document.getElementById('customContent-' + catId);
  const statsEl = document.getElementById('customStats-' + catId);
  if (!contentEl) return;

  if (!catBlock || !catBlock.news || catBlock.news.length === 0) {
    contentEl.innerHTML = '<div class="custom-empty-news"><p>暂未搜索到相关资讯。系统通过搜索引擎（百度新闻、搜狗新闻、Google News）全网采集。</p><p class="custom-empty-hint">建议多填几个关键词（中英文），如「游戏, game, steam」。</p></div>';
    if (statsEl) statsEl.innerHTML = '';
    return;
  }

  const newsByGroup = {};
  catBlock.news.forEach(item => {
    const g = item.category || catBlock.name || '资讯';
    if (!newsByGroup[g]) newsByGroup[g] = [];
    newsByGroup[g].push(item);
  });

  let html = '';
  for (const [group, items] of Object.entries(newsByGroup)) {
    html += '<div class="category-card"><div class="category-header"><span class="category-icon">📌</span><h2 class="category-title">' + group + '</h2><span class="category-count">' + items.length + ' 条</span></div><div class="news-list">';
    for (const item of items.slice(0, 15)) {
      html += '<div class="news-item"><span class="news-dot"></span><div class="news-body"><h3 class="news-title"><a href="' + item.link + '" target="_blank" rel="noopener">' + item.title + '</a></h3><div class="news-meta"><span class="news-source">' + item.source + '</span><span>' + (item.date ? new Date(item.date).toLocaleDateString('zh-CN') : '') + '</span></div></div></div>';
    }
    html += '</div></div>';
  }
  contentEl.innerHTML = html;

  const kw = catBlock.keywords ? catBlock.keywords.join(', ') : '';
  if (statsEl) statsEl.innerHTML = '<span class="stat-chip">📰 ' + catBlock.news.length + ' 条</span><span class="stat-chip green">🔑 ' + kw + '</span>';
}

async function loadCustomDate(catId, dateStr) {
  if (customCache[dateStr]) {
    renderCustomPanel(catId, dateStr, customCache[dateStr]);
    return;
  }
  const contentEl = document.getElementById('customContent-' + catId);
  if (contentEl) contentEl.innerHTML = '<div class="empty-state"><h2>加载中…</h2></div>';
  try {
    const resp = await fetch('/custom-data-' + dateStr + '.json');
    if (resp.ok) {
      const d = await resp.json();
      customCache[dateStr] = d;
      renderCustomPanel(catId, dateStr, d);
    } else {
      renderCustomPanel(catId, dateStr, []);
    }
  } catch {
    renderCustomPanel(catId, dateStr, []);
  }
}

customCategories.forEach(cat => {
  const sel = document.querySelector('select.date-select[data-cat="' + cat.id + '"]');
  if (!sel) return;

  customDates.forEach(d => {
    const o = document.createElement('option');
    o.value = d;
    o.textContent = fmtDate(d);
    sel.appendChild(o);
  });

  if (customDates.length > 0) {
    sel.value = customDates[customDates.length - 1];
    loadCustomDate(cat.id, customDates[customDates.length - 1]);
  }

  sel.addEventListener('change', () => loadCustomDate(cat.id, sel.value));

  const prevBtn = document.querySelector('button.date-prev[data-cat="' + cat.id + '"]');
  const nextBtn = document.querySelector('button.date-next[data-cat="' + cat.id + '"]');

  function updateCustomNav() {
    const idx = customDates.indexOf(sel.value);
    if (prevBtn) prevBtn.disabled = idx <= 0;
    if (nextBtn) nextBtn.disabled = idx >= customDates.length - 1;
  }

  if (prevBtn) prevBtn.addEventListener('click', () => {
    const idx = customDates.indexOf(sel.value);
    if (idx > 0) { sel.value = customDates[idx - 1]; loadCustomDate(cat.id, sel.value); updateCustomNav(); }
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    const idx = customDates.indexOf(sel.value);
    if (idx < customDates.length - 1) { sel.value = customDates[idx + 1]; loadCustomDate(cat.id, sel.value); updateCustomNav(); }
  });

  updateCustomNav();
});

// ════════════════════════════════
// 删除栏目
// ════════════════════════════════
document.querySelectorAll('.delete-cat-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const catId = btn.dataset.catId;
    const catName = btn.dataset.catName;
    if (!confirm('确定删除「' + catName + '」栏目？删除后数据不可恢复。')) return;

    btn.disabled = true;
    btn.textContent = '删除中…';
    try {
      const resp = await fetch('/api/delete-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: catId })
      });
      let data = {};
      try { data = await resp.json(); } catch {}
      if (resp.ok) {
        location.reload();
      } else {
        alert('删除失败: ' + (data.error || '请重试'));
        btn.disabled = false;
        btn.textContent = '删除栏目';
      }
    } catch (e) {
      alert('删除失败: ' + e.message);
      btn.disabled = false;
      btn.textContent = '删除栏目';
    }
  });
});

// ════════════════════════════════
// Modal
// ════════════════════════════════
const modalOverlay = document.getElementById('modalOverlay');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const cancelBtn = document.getElementById('cancelBtn');
const submitBtn = document.getElementById('submitBtn');
const collectLoadingOverlay = document.getElementById('collectLoadingOverlay');

let collectInProgress = false;
function setCollectLoading(show) {
  collectInProgress = show;
  if (!collectLoadingOverlay) return;
  collectLoadingOverlay.classList.toggle('show', show);
  collectLoadingOverlay.setAttribute('aria-busy', show ? 'true' : 'false');
}

addCategoryBtn?.addEventListener('click', () => { if (!collectInProgress) modalOverlay.classList.add('active'); });
cancelBtn?.addEventListener('click', () => { if (!collectInProgress) modalOverlay.classList.remove('active'); });
modalOverlay?.addEventListener('click', e => { if (e.target === modalOverlay && !collectInProgress) modalOverlay.classList.remove('active'); });

submitBtn?.addEventListener('click', async () => {
  const name = document.getElementById('categoryName').value.trim();
  const keywords = document.getElementById('categoryKeywords').value.split(',').map(k => k.trim()).filter(k => k);
  if (!name || keywords.length === 0) { alert('请填写分类名称和关键词'); return; }

  submitBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;
  setCollectLoading(true);

  try {
    const response = await fetch('/api/add-category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, keywords })
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (response.ok) {
      document.getElementById('categoryName').value = '';
      document.getElementById('categoryKeywords').value = '';
      modalOverlay.classList.remove('active');
      const hint = collectLoadingOverlay?.querySelector('.collect-loading-hint');
      if (hint) hint.textContent = '采集完成，正在刷新页面…';
      location.reload();
    } else {
      setCollectLoading(false);
      alert('添加失败: ' + (data.error || response.statusText || '请重试'));
    }
  } catch (e) {
    setCollectLoading(false);
    alert('无法连接服务。若在本机开发，请先运行 npm start。\\n详情: ' + e.message);
  }

  submitBtn.disabled = false;
  if (cancelBtn) cancelBtn.disabled = false;
});
</script>
</body>
</html>`;
}

if (require.main === module) {
  generateHTML().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { generateHTML };

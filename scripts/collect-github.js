const fs = require('fs');
const path = require('path');

// 翻译缓存
const translationCache = {};
const CACHE_FILE = path.join(__dirname, '..', 'data', 'translation-cache.json');

// 加载翻译缓存
function loadTranslationCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      Object.assign(translationCache, JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')));
    }
  } catch (e) {}
}

// 保存翻译缓存
function saveTranslationCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(translationCache, null, 2));
}

// 简易翻译函数（使用免费API）
async function translateToChinese(text) {
  if (!text || text === '暂无描述') return text;
  
  // 检查缓存
  if (translationCache[text]) {
    return translationCache[text];
  }
  
  try {
    // 使用 MyMemory 免费翻译API
    const encodedText = encodeURIComponent(text);
    const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=en|zh-CN`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translated = data.responseData.translatedText;
      translationCache[text] = translated;
      return translated;
    }
  } catch (error) {
    console.log(`  ⚠️ 翻译失败: ${text.substring(0, 30)}...`);
  }
  
  return text;
}

// 批量翻译
async function translateBatch(texts) {
  const results = [];
  for (const text of texts) {
    const translated = await translateToChinese(text);
    results.push(translated);
    // 避免请求过快
    await new Promise(r => setTimeout(r, 100));
  }
  return results;
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

function getFirstDayOfMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getProjectAgeDays(createdAt) {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.max(1, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
}

function calculateDailyGrowth(stars, createdAt) {
  const ageDays = getProjectAgeDays(createdAt);
  return (stars / ageDays).toFixed(2);
}

// 排序函数 - 按创建时间
function sortByCreated(projects, order) {
  return projects.sort((a, b) => {
    const dateA = new Date(a.created_at || '1970-01-01');
    const dateB = new Date(b.created_at || '1970-01-01');
    return order === 'desc' ? dateB - dateA : dateA - dateB;
  });
}

async function fetchGitHubList(config) {
  const { title, query, sort, order, perPage, postSort } = config;
  console.log(`📊 ${title}`);
  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=${sort || 'stars'}&order=${order || 'desc'}&per_page=${perPage}`;
    const response = await fetch(url, { 
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'AI-News-Collector' } 
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    let projects = data.items.slice(0, 30);
    console.log(`  ✅ 获取 ${projects.length} 个项目`);
    
    // 提取所有description
    const descriptions = projects.map(r => r.description || '暂无描述');
    
    // 批量翻译
    console.log(`  🌐 翻译中...`);
    const translatedDescriptions = await translateBatch(descriptions);
    
    projects = projects.map((r, i) => ({
      name: r.full_name,
      description: r.description || '暂无描述',
      cn_description: translatedDescriptions[i],
      stars: r.stargazers_count,
      language: r.language || 'Unknown',
      url: r.html_url,
      forks: r.forks_count,
      issues: r.open_issues_count,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
    
    // 如果需要后排序
    if (postSort) {
      projects = postSort(projects);
    }
    
    return projects;
  } catch (error) {
    console.error(`  ❌ ${error.message}`);
    return [];
  }
}

async function fetchGitHubTrending() {
  console.log('🚀 GitHub 多榜单采集中...');
  
  // 加载翻译缓存
  loadTranslationCache();
  
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  
  // 读取已有数据
  const trendingFile = path.join(dataDir, 'github-trending.json');
  let existingData = null;
  if (fs.existsSync(trendingFile)) {
    try {
      existingData = JSON.parse(fs.readFileSync(trendingFile, 'utf-8'));
    } catch (e) {}
  }
  
  const thirtyDaysAgo = getDateDaysAgo(30);
  const firstDayOfMonth = getFirstDayOfMonth();
  
  // 需要每天更新的栏目
  const dailyLists = {
    'trending': { title: '🔥 今日热榜', query: 'stars:>5000', sort: 'stars', order: 'desc', perPage: 20 },
    'most-forked': { title: '🍴 Fork最多', query: 'stars:>300', sort: 'forks', order: 'desc', perPage: 20 },
    'new-this-month': { title: '🚀 本月新星', query: `created:>${firstDayOfMonth} stars:>10`, sort: 'stars', order: 'desc', perPage: 20 },
    'trending-growth': { title: '💥 飙升榜', query: `created:>${thirtyDaysAgo} stars:>5`, sort: 'stars', order: 'desc', perPage: 30 },
    'chinese': { title: '🌍 中文项目', query: 'stars:>50 topic:chinese', sort: 'stars', order: 'desc', perPage: 20 },
    'newest': { title: '⏰ 最新创建', query: `created:>${thirtyDaysAgo} stars:>5`, sort: 'created', order: 'desc', perPage: 20, 
      postSort: (arr) => sortByCreated(arr, 'desc') },
  };
  
  // 静态栏目（只采集一次）
  const staticLists = {
    'oldest': { title: '📅 最老创建', query: 'created:<2015-01-01 stars:>100', sort: 'created', order: 'asc', perPage: 20,
      postSort: (arr) => sortByCreated(arr, 'asc') }
  };
  
  const results = {};
  
  // 每天更新的栏目
  for (const [key, config] of Object.entries(dailyLists)) {
    results[key] = await fetchGitHubList(config);
    await new Promise(r => setTimeout(r, 500));
  }
  
  // 计算飙升榜
  console.log('📊 计算飙升榜增长率...');
  const growthProjects = results['trending-growth'].map(p => {
    const dailyGrowth = parseFloat(calculateDailyGrowth(p.stars, p.created_at));
    const ageDays = getProjectAgeDays(p.created_at);
    return { ...p, starGrowth: dailyGrowth, ageDays };
  }).sort((a, b) => b.starGrowth - a.starGrowth).slice(0, 20);
  results['trending-growth'] = growthProjects;
  
  // 补充中文项目
  if (!results['chinese'] || results['chinese'].length < 5) {
    console.log('📊 补充中文项目...');
    const extra = await fetchGitHubList({ title: '补充', query: 'stars:>30 org:Tencent', sort: 'stars', order: 'desc', perPage: 15 });
    if (extra.length > 0) {
      results['chinese'] = [...(results['chinese'] || []), ...extra].slice(0, 20);
    }
  }
  
  // 静态栏目：如果已有数据就直接用，没有才采集
  if (existingData?.lists?.oldest && existingData.lists.oldest.length > 0) {
    console.log('📊 📅 最老创建: 使用缓存（静态数据）');
    results['oldest'] = existingData.lists.oldest;
  } else {
    console.log('📊 📅 最老创建: 首次采集...');
    results['oldest'] = await fetchGitHubList(staticLists['oldest']);
  }
  
  // 保存翻译缓存
  saveTranslationCache();
  
  const result = { 
    date: new Date().toISOString().split('T')[0], 
    timestamp: new Date().toISOString(), 
    lists: results 
  };
  fs.writeFileSync(trendingFile, JSON.stringify(result, null, 2));
  console.log('✅ 完成!');
}

module.exports = { fetchGitHubTrending };
if (require.main === module) fetchGitHubTrending();

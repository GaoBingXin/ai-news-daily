#!/usr/bin/env node

/**
 * OpenClaw Agent 入口脚本
 *
 * 用法:
 *   node scripts/agent-collect.js              # 采集所有自定义栏目 + 重新生成 HTML
 *   node scripts/agent-collect.js --new-only   # 只采集尚未采集过的新栏目
 *   node scripts/agent-collect.js --full       # 完整流程: AI资讯 + GitHub热榜 + 自定义栏目 + 生成HTML
 *
 * 适用场景:
 *   1. 用户在页面添加栏目后，OpenClaw 立刻运行本脚本采集该栏目
 *   2. 每日定时任务中 --full 跑完整流程
 */

const fs = require('fs');
const path = require('path');
const { collectCustomCategory, collectAllCustomCategories } = require('./collect-custom');
const { generateHTML } = require('./generate-html');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CATEGORIES_FILE = path.join(DATA_DIR, 'custom-categories.json');
const CUSTOM_DATA_FILE = path.join(DATA_DIR, 'custom-data.json');

function loadJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function saveCustomData(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CUSTOM_DATA_FILE, JSON.stringify(list, null, 2));
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(DATA_DIR, 'custom-data-' + today + '.json'), JSON.stringify(list, null, 2));
}

/** 只采集尚未采集过的新栏目 */
async function collectNewOnly() {
  const categories = loadJSON(CATEGORIES_FILE);
  const existing = loadJSON(CUSTOM_DATA_FILE);
  const existingIds = new Set(existing.map((c) => c.id));
  const newCats = categories.filter((c) => !existingIds.has(c.id));

  if (newCats.length === 0) {
    console.log('没有新栏目需要采集');
    return;
  }

  console.log(`发现 ${newCats.length} 个新栏目，开始采集...`);
  for (const cat of newCats) {
    const block = await collectCustomCategory(cat);
    existing.push(block);
    saveCustomData(existing);
    console.log(`✅「${cat.name}」采集完成`);
  }
  await generateHTML();
  console.log('✅ HTML 已重新生成');
}

/** 采集所有自定义栏目（覆盖旧数据） */
async function collectAll() {
  await collectAllCustomCategories();
  await generateHTML();
  console.log('✅ HTML 已重新生成');
}

/** 完整流程 */
async function fullPipeline() {
  console.log('=== 完整采集流程 ===\n');

  console.log('--- 1/4 AI资讯采集 ---');
  try {
    const { collectNews } = require('./collect-news');
    await collectNews();
  } catch (e) {
    console.error('AI资讯采集失败:', e.message);
  }

  console.log('\n--- 2/4 GitHub热榜 ---');
  try {
    const { fetchGitHubTrending } = require('./collect-github');
    await fetchGitHubTrending();
  } catch (e) {
    console.error('GitHub热榜采集失败:', e.message);
  }

  console.log('\n--- 3/4 自定义栏目 ---');
  try {
    await collectAllCustomCategories();
  } catch (e) {
    console.error('自定义栏目采集失败:', e.message);
  }

  console.log('\n--- 4/4 生成HTML ---');
  await generateHTML();
  console.log('\n=== 完整流程结束 ===');
}

// ─── CLI ─────────────────────────────────────────────────────
const flag = process.argv[2];

if (flag === '--full') {
  fullPipeline().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else if (flag === '--new-only') {
  collectNewOnly().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  collectAll().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

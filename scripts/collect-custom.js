#!/usr/bin/env node

/**
 * 自定义栏目采集 —— 基于搜索引擎的「全网搜索」策略
 *
 * 用户填写关键词 → 脚本通过百度新闻、搜狗新闻、Google News RSS 三路搜索 → 合并去重 → 存入 JSON
 * 同时用关键词在 GitHub 搜索相关仓库。
 */

const axios = require('axios');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── 搜索引擎采集 ────────────────────────────────────────────

/** 从百度新闻的相对时间文本中推算出 ISO 日期字符串 */
function parseBaiduTime(text) {
  if (!text) return '';
  const now = new Date();
  const m = text.match(/(\d+)\s*分钟前/);
  if (m) { now.setMinutes(now.getMinutes() - parseInt(m[1])); return now.toISOString(); }
  const h = text.match(/(\d+)\s*小时前/);
  if (h) { now.setHours(now.getHours() - parseInt(h[1])); return now.toISOString(); }
  const d = text.match(/(\d+)\s*天前/);
  if (d) { now.setDate(now.getDate() - parseInt(d[1])); return now.toISOString(); }
  const abs = text.match(/(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})/);
  if (abs) return new Date(abs[1], parseInt(abs[2]) - 1, abs[3]).toISOString();
  const md = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (md) return new Date(now.getFullYear(), parseInt(md[1]) - 1, md[2]).toISOString();
  if (/昨天/.test(text)) { now.setDate(now.getDate() - 1); return now.toISOString(); }
  if (/前天/.test(text)) { now.setDate(now.getDate() - 2); return now.toISOString(); }
  return '';
}

/** 百度新闻搜索 */
async function searchBaiduNews(query) {
  const items = [];
  try {
    const url =
      'https://www.baidu.com/s?wd=' +
      encodeURIComponent(query + ' 资讯') +
      '&tn=news&rtt=4&bsst=1&cl=2&medium=0';
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
      timeout: 15000,
    });
    const $ = cheerio.load(data);
    $('h3 a, .c-title a, .news-title a, .news-title-font_1xS-F a').each((_, el) => {
      const t = $(el).text().trim().replace(/\s+/g, ' ');
      const h = $(el).attr('href');
      if (t.length > 8 && h) {
        const container = $(el).closest('.result, .c-container, [class*="news-item"]');
        const timeText = container.find('.c-color-gray, .c-color-gray2, .news-source span, [class*="time"], [class*="date"]').last().text().trim();
        items.push({ title: t.substring(0, 150), link: h, source: '百度新闻', date: parseBaiduTime(timeText) });
      }
    });
    console.log(`  百度新闻: ${items.length} 条`);
  } catch (e) {
    console.log(`  百度新闻: 失败 (${e.message.substring(0, 40)})`);
  }
  return items;
}

/** 搜狗新闻搜索 */
async function searchSogouNews(query) {
  const items = [];
  try {
    const url =
      'https://news.sogou.com/news?query=' +
      encodeURIComponent(query) +
      '&mode=1&sort=1';
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 15000,
    });
    const $ = cheerio.load(data);
    $('h3 a, .news-title a, .vrTitle a, .vr-title a').each((_, el) => {
      const t = $(el).text().trim().replace(/\s+/g, ' ');
      const h = $(el).attr('href');
      if (t.length > 5 && h) {
        const container = $(el).closest('.vrwrap, .rb, [class*="news"]');
        const timeText = container.find('.news-from span, .news-detail-time, [class*="time"]').last().text().trim();
        items.push({ title: t.substring(0, 150), link: h, source: '搜狗新闻', date: parseBaiduTime(timeText) });
      }
    });
    console.log(`  搜狗新闻: ${items.length} 条`);
  } catch (e) {
    console.log(`  搜狗新闻: 失败 (${e.message.substring(0, 40)})`);
  }
  return items;
}

/** Google News RSS（国内可能超时，云服务器大概率能用） */
async function searchGoogleNews(query) {
  const items = [];
  try {
    const parser = new Parser({
      headers: { 'User-Agent': UA },
      timeout: 8000,
    });
    const zhUrl =
      'https://news.google.com/rss/search?q=' +
      encodeURIComponent(query) +
      '&hl=zh-CN&gl=CN&ceid=CN:zh-Hans';
    const feed = await parser.parseURL(zhUrl);
    for (const entry of feed.items.slice(0, 30)) {
      if (entry.title && entry.link) {
        items.push({
          title: entry.title.substring(0, 150),
          link: entry.link,
          source: 'Google News',
          date: entry.pubDate || entry.isoDate || '',
          summary: (entry.contentSnippet || '').substring(0, 200),
        });
      }
    }
    console.log(`  Google News: ${items.length} 条`);
  } catch (e) {
    console.log(`  Google News: 跳过 (${e.message.substring(0, 40)})`);
  }
  return items;
}

/** 英文关键词额外走一次 Google News 英文版 */
async function searchGoogleNewsEN(query) {
  const items = [];
  try {
    const parser = new Parser({
      headers: { 'User-Agent': UA },
      timeout: 8000,
    });
    const url =
      'https://news.google.com/rss/search?q=' +
      encodeURIComponent(query) +
      '&hl=en&gl=US&ceid=US:en';
    const feed = await parser.parseURL(url);
    for (const entry of feed.items.slice(0, 20)) {
      if (entry.title && entry.link) {
        items.push({
          title: entry.title.substring(0, 150),
          link: entry.link,
          source: 'Google News (EN)',
          date: entry.pubDate || entry.isoDate || '',
          summary: (entry.contentSnippet || '').substring(0, 200),
        });
      }
    }
    console.log(`  Google News EN: ${items.length} 条`);
  } catch (e) {
    console.log(`  Google News EN: 跳过 (${e.message.substring(0, 40)})`);
  }
  return items;
}

/**
 * 汇总：用所有搜索引擎按关键词采集新闻
 * @param {string} categoryName
 * @param {string[]} keywords
 */
async function searchNewsForCategory(categoryName, keywords) {
  console.log(`\n📰 全网搜索「${categoryName}」的资讯...`);
  const all = [];
  const seen = new Set();

  for (const kw of keywords) {
    const [baidu, sogou, googleCN, googleEN] = await Promise.all([
      searchBaiduNews(kw),
      searchSogouNews(kw),
      searchGoogleNews(kw),
      /^[a-zA-Z0-9 ]+$/.test(kw) ? searchGoogleNewsEN(kw) : Promise.resolve([]),
    ]);

    for (const item of [...baidu, ...sogou, ...googleCN, ...googleEN]) {
      const key = item.title.substring(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      all.push({
        title: item.title,
        link: item.link,
        source: item.source,
        date: item.date || new Date().toISOString(),
        summary: item.summary || '',
        category: categoryName,
      });
    }

    if (keywords.length > 1) await new Promise((r) => setTimeout(r, 300));
  }

  all.sort((a, b) => new Date(b.date) - new Date(a.date));
  console.log(`  合计去重后: ${all.length} 条资讯`);
  return all.slice(0, 80);
}

// ─── 入口 ────────────────────────────────────────────────────

async function collectCustomCategory(categoryData) {
  const { id, name, keywords } = categoryData;
  const news = await searchNewsForCategory(name, keywords);
  return { id, name, keywords, news };
}

async function collectAllCustomCategories() {
  console.log('🚀 开始采集所有自定义栏目...\n');

  const configFile = path.join(__dirname, '..', 'data', 'custom-categories.json');
  let categories = [];
  if (fs.existsSync(configFile)) {
    categories = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  }

  if (categories.length === 0) {
    console.log('暂无自定义栏目');
    return [];
  }

  const results = [];
  for (const cat of categories) {
    const data = await collectCustomCategory(cat);
    results.push(data);
    if (categories.length > 1) await new Promise((r) => setTimeout(r, 500));
  }

  const dataFile = path.join(__dirname, '..', 'data', 'custom-data.json');
  fs.writeFileSync(dataFile, JSON.stringify(results, null, 2));

  const today = new Date().toISOString().slice(0, 10);
  const datedFile = path.join(__dirname, '..', 'data', 'custom-data-' + today + '.json');
  fs.writeFileSync(datedFile, JSON.stringify(results, null, 2));

  console.log(`\n✅ 完成！共采集 ${results.length} 个栏目`);
  return results;
}

module.exports = { collectAllCustomCategories, collectCustomCategory };
if (require.main === module) collectAllCustomCategories();

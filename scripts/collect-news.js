const axios = require('axios');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
const fs = require('fs').promises;
const path = require('path');
const { getAllHistoricalLinks } = require("./utils");
const { format } = require('date-fns');

// 配置资讯来源 - 已验证可用
const sources = [
  // RSS 订阅源
  { name: '量子位', type: 'rss', url: 'https://www.qbitai.com/feed' },
  { name: 'Wired', type: 'rss', url: 'https://www.wired.com/feed/rss' },
  { name: 'TechCrunch', type: 'rss', url: 'https://techcrunch.com/feed/' },
  { name: 'The Verge', type: 'rss', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Ars Technica', type: 'rss', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { name: 'The Register', type: 'rss', url: 'https://www.theregister.com/headlines.atom' },
  
  // 中文 HTML 采集
  { name: '36Kr-AI', type: 'html', url: 'https://www.36kr.com/information/AI/', selector: 'a[href*="/p/"]', titleSel: 'a' },
  { name: '机器之心', type: 'html', url: 'https://www.jiqizhixin.com/', selector: 'a[href^="/news"]', titleSel: 'a' },
  { name: '虎嗅', type: 'html', url: 'https://www.huxiu.com/', selector: 'a[href*="article"]', titleSel: 'a' },
  { name: '品玩', type: 'html', url: 'https://www.pingwest.com/', selector: 'a[href*="/article"]', titleSel: 'a' },
  { name: '钛媒体', type: 'html', url: 'https://www.tmtpost.com/', selector: 'a[href*="/note"]', titleSel: 'a' },
  { name: '雷科技', type: 'html', url: 'https://www.leikeji.com/', selector: 'a[href*="/article"]', titleSel: 'a' },
  { name: '爱范儿', type: 'html', url: 'https://www.ifanr.com/', selector: 'a[href*="/"]', titleSel: 'a' },
  { name: '少数派', type: 'html', url: 'https://sspai.com/', selector: 'a[href*="/post"]', titleSel: 'a' },
  { name: '腾讯科技', type: 'html', url: 'https://new.qq.com/ch/tech/', selector: 'a[href*="new.qq.com/omn"]', titleSel: 'a' },
  { name: '新浪科技', type: 'html', url: 'https://tech.sina.com.cn/', selector: 'a[href*="tech.sina.com.cn"]', titleSel: 'a' },
  { name: '网易科技', type: 'html', url: 'https://tech.163.com/', selector: 'a[href*="tech.163.com"]', titleSel: 'a' },
  
  // GitHub API
  { name: 'OpenAI', type: 'api', url: 'https://api.github.com/repos/openai/news/releases' },
  { name: 'LangChain', type: 'api', url: 'https://api.github.com/repos/langchain-ai/langchain/releases' },
  { name: 'Transformers', type: 'api', url: 'https://api.github.com/repos/huggingface/transformers/releases' },
];

// 关键词过滤
const aiKeywords = [
  'ai', '人工智能', '机器学习', '深度学习', '大模型', 'llm', 'gpt', 
  'chatgpt', 'midjourney', 'stable diffusion', '神经网络', 'transformer',
  'openai', 'anthropic', 'claude', 'gemini', 'deepseek', '文心一言', 
  '通义千问', 'kimi', 'llama', 'sora', 'video', 'diffusion', '模型',
  'agent', 'rag', 'embedding', 'token', 'nlp', 'cv', 'aigc'
];

// 主采集函数
async function collectNews() {
  console.log('开始采集AI热点资讯...');
  console.log(`共 ${sources.length} 个数据源`);
  const allNews = [];
  const parser = new Parser({ timeout: 15000 });
  let successCount = 0;

  for (const source of sources) {
    try {
      console.log(`正在采集: ${source.name}...`);
      let items = [];
      
      if (source.type === 'rss') {
        items = await fetchRSS(parser, source);
      } else if (source.type === 'html') {
        items = await fetchHTML(source);
      } else if (source.type === 'api') {
        items = await fetchAPI(source);
      }
      
      // 过滤AI相关内容
      for (const item of items) {
        const text = (item.title + ' ' + (item.summary || '')).toLowerCase();
        const isAI = aiKeywords.some(k => text.includes(k.toLowerCase()));
        
        if (isAI && item.title && item.link && item.title.length > 5) {
          allNews.push({
            title: item.title.trim().substring(0, 150),
            link: item.link,
            source: source.name,
            date: item.date || new Date().toISOString(),
            summary: (item.summary || '').substring(0, 200),
            category: detectCategory(text),
          });
        }
      }
      
      if (items.length > 0) {
        successCount++;
        console.log(`  ✅ ${source.name}: 获取 ${items.length} 条`);
      }
    } catch (error) {
      console.error(`  ❌ ${source.name}: ${error.message.substring(0, 40)}`);
    }
  }

  console.log(`
成功采集 ${successCount}/${sources.length} 个数据源`);

  // 读取历史链接用于去重
  const historicalLinks = await getAllHistoricalLinks();
  console.log(`历史资讯库共有 ${historicalLinks.size} 条链接`);
  
  // 去重（同时过滤历史已采集的链接）
  const seen = new Set();
  const uniqueNews = allNews.filter(n => {
    const key = n.title.substring(0, 50);
    if (seen.has(key)) return false;
    // 跳过历史已采集的链接
    if (historicalLinks.has(n.link)) return false;
    seen.add(key);
    return true;
  });

  // 排序
  uniqueNews.sort((a, b) => new Date(b.date) - new Date(a.date));
  const news = uniqueNews.slice(0, 80);

  // 保存
  const dataDir = path.join(__dirname, '../data');
  await fs.mkdir(dataDir, { recursive: true });
  
  const today = format(new Date(), 'yyyy-MM-dd');
  await fs.writeFile(path.join(dataDir, `news-${today}.json`), JSON.stringify({
    date: today,
    count: news.length,
    sourceCount: successCount,
    news: news
  }, null, 2));

  await fs.writeFile(path.join(dataDir, 'latest.json'), JSON.stringify({
    date: today,
    count: news.length,
    sourceCount: successCount,
    news: news
  }, null, 2));

  console.log(`采集完成！共收集 ${news.length} 条AI资讯`);
  return news;
}

async function fetchRSS(parser, source) {
  const feed = await parser.parseURL(source.url);
  return feed.items.map(item => ({
    title: item.title,
    link: item.link,
    date: item.pubDate,
    summary: item.contentSnippet || item.content || '',
  })).slice(0, 15);
}

async function fetchHTML(source) {
  const { data } = await axios.get(source.url, { 
    timeout: 15000,
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    maxRedirects: 5
  });
  const $ = cheerio.load(data);
  const items = [];
  
  $(source.selector).each((_, el) => {
    const title = $(el).text().trim();
    const href = $(el).attr('href');
    if (title && href && title.length > 5 && title.length < 100) {
      let link = href;
      if (!href.startsWith('http')) {
        if (href.startsWith('/')) {
          const urlObj = new URL(source.url);
          link = urlObj.origin + href;
        } else {
          link = source.url + href;
        }
      }
      items.push({
        title,
        link,
        date: new Date().toISOString(),
        summary: '',
      });
    }
  });
  return items.slice(0, 15);
}

async function fetchAPI(source) {
  const { data } = await axios.get(source.url, { 
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  
  if (source.url.includes('github.com')) {
    return data.slice(0, 10).map(item => ({
      title: item.name || item.tag_name || 'Release',
      link: item.html_url,
      date: item.published_at,
      summary: (item.body || item.description || '').substring(0, 200),
    }));
  }
  return [];
}

function detectCategory(text) {
  if (text.includes('gpt') || text.includes('chatgpt') || text.includes('openai')) return 'OpenAI';
  if (text.includes('gemini') || text.includes('google') || text.includes('deepmind')) return 'Google';
  if (text.includes('claude') || text.includes('anthropic')) return 'Anthropic';
  if (text.includes('deepseek') || text.includes('moonshot') || text.includes('kimi')) return '国产大模型';
  if (text.includes('midjourney') || text.includes('stable diffusion') || text.includes('dalle') || text.includes('runway')) return 'AI图像';
  if (text.includes('sora') || text.includes('video') || text.includes('runway')) return 'AI视频';
  if (text.includes('llm') || text.includes('大模型') || text.includes('语言模型')) return '大模型';
  if (text.includes('agent') || text.includes('agent') || text.includes('智能体')) return 'AI Agent';
  if (text.includes('论文') || text.includes('research') || text.includes('研究')) return '研究';
  if (text.includes('huggingface') || text.includes('model')) return '模型';
  return 'AI综合';
}

if (require.main === module) {
  collectNews()
    .then(() => { console.log('完成'); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
}

module.exports = { collectNews };

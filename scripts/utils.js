const fs = require('fs').promises;
const path = require('path');
const { format } = require('date-fns');

// 读取历史新闻的链接（不包括今天）
async function getAllHistoricalLinks() {
  const dataDir = path.join(__dirname, '../data');
  const links = new Set();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  try {
    const files = await fs.readdir(dataDir);
    for (const file of files) {
      // 跳过 latest.json 和今天的文件
      if (file === 'latest.json') continue;
      if (file === `news-${today}.json`) continue;
      if (!file.startsWith('news-') || !file.endsWith('.json')) continue;
      
      const data = JSON.parse(await fs.readFile(path.join(dataDir, file), 'utf-8'));
      for (const item of data.news) {
        if (item.link) links.add(item.link);
      }
    }
  } catch (e) {
    // 忽略错误
  }
  
  return links;
}

module.exports = { getAllHistoricalLinks };

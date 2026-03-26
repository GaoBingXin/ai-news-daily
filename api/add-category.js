const { addCategory } = require('../scripts/category-store');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: '无效的 JSON' });
      }
    }

    const { name, keywords } = body || {};

    if (!name || !keywords || (!Array.isArray(keywords) && typeof keywords !== 'string')) {
      return res.status(400).json({ error: '请填写分类名称和关键词' });
    }

    const keywordList =
      typeof keywords === 'string'
        ? keywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean)
        : keywords.filter(Boolean);

    if (keywordList.length === 0) {
      return res.status(400).json({ error: '请填写有效的关键词' });
    }

    const entry = addCategory(name, keywordList);

    return res.status(200).json({
      success: true,
      id: entry.id,
      message: '添加成功！',
    });
  } catch (error) {
    const code = error.statusCode || 500;
    if (code >= 500) console.error('Error:', error);
    return res.status(code).json({ error: error.message || '服务器错误' });
  }
}

module.exports = handler;

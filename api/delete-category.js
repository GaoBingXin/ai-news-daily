const { deleteCategory } = require('../scripts/category-store');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch {
        return res.status(400).json({ error: '无效的 JSON' });
      }
    }

    const { id } = body || {};
    if (!id) return res.status(400).json({ error: '缺少分类 ID' });

    const result = deleteCategory(id);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    const code = error.statusCode || 500;
    if (code >= 500) console.error('Error:', error);
    return res.status(code).json({ error: error.message || '服务器错误' });
  }
}

module.exports = handler;

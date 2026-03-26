const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Vercel Token（从环境变量获取）
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

async function deployToVercel() {
  console.log('开始部署到Vercel...');
  
  try {
    // 确保public目录存在
    const publicDir = path.join(__dirname, '../public');
    try {
      await fs.access(publicDir);
    } catch {
      console.log('public目录不存在，创建...');
      await fs.mkdir(publicDir, { recursive: true });
      await fs.writeFile(path.join(publicDir, 'index.html'), '<h1>AI热点资讯日报</h1><p>数据正在采集中...</p>');
    }

    const vercelConfig = {
      "version": 2,
      "builds": [{"src": "public/**", "use": "@vercel/static"}],
      "routes": [{"src": "/(.*)", "dest": "/public/$1"}],
      "github": {"enabled": true, "silent": true},
      "env": {"NODE_ENV": "production"}
    };

    await fs.writeFile(path.join(__dirname, '../vercel.json'), JSON.stringify(vercelConfig, null, 2));

    const deployScript = `#!/bin/bash
set -e
echo "🚀 开始部署AI热点资讯日报..."
if ! command -v vercel &> /dev/null; then
  npm install -g vercel
fi
vercel --prod --yes
echo "✅ 部署完成！"
`;

    await fs.writeFile(path.join(__dirname, '../deploy.sh'), deployScript);
    await fs.chmod(path.join(__dirname, '../deploy.sh'), '755');
    console.log('部署配置已创建完成！');
  } catch (error) {
    console.error('部署配置创建失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  deployToVercel().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
module.exports = { deployToVercel };

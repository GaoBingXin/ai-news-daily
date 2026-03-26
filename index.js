#!/usr/bin/env node

const { collectNews } = require('./scripts/collect-news');
const { generateHTML } = require('./scripts/generate-html');
const { deployToVercel } = require('./scripts/deploy');

async function main() {
  console.log('🤖 AI热点资讯采集系统启动...');
  console.log('=' .repeat(50));
  
  const command = process.argv[2];
  
  switch (command) {
    case 'collect':
      console.log('执行资讯采集...');
      await collectNews();
      break;
      
    case 'build':
      console.log('生成HTML页面...');
      await generateHTML();
      break;
      
    case 'deploy':
      console.log('配置Vercel部署...');
      await deployToVercel();
      break;
      
    case 'all':
      console.log('执行完整流程...');
      await collectNews();
      await generateHTML();
      await deployToVercel();
      break;
      
    default:
      console.log(`
AI热点资讯采集系统 - 使用说明
==============================

命令:
  npm run collect   采集最新资讯
  npm run build     生成HTML页面
  npm run deploy    配置Vercel部署
  npm run all       执行完整流程

环境配置:
  1. 确保已安装Node.js 16+
  2. 配置Vercel Token环境变量
  3. 设置定时任务（每天8点执行）

定时任务配置（OpenClaw）:
  在OpenClaw中设置定时任务：
  - 时间: 每天8:00
  - 命令: cd /path/to/ai-news-collector && npm run all
  - 输出: 自动部署到Vercel

GitHub仓库:
  建议将项目推送到GitHub，启用Vercel自动部署
      `);
      break;
  }
  
  console.log('=' .repeat(50));
  console.log('✨ 操作完成！');
}

main().catch(error => {
  console.error('❌ 系统执行失败:', error);
  process.exit(1);
});

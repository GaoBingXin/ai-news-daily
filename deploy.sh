#!/bin/bash
set -e

echo "🚀 开始部署AI热点资讯日报..."

# 检查是否已安装vercel-cli
if ! command -v vercel &> /dev/null; then
  echo "正在安装vercel-cli..."
  npm install -g vercel
fi

# 部署到Vercel (使用环境变量 VERCEL_TOKEN)
echo "正在部署..."
vercel --prod --yes

echo "✅ 部署完成！"

# 定时任务配置

由于系统环境限制，需要手动配置定时任务：

## 方案1: 系统 crontab
```bash
# 编辑 crontab
crontab -e

# 添加以下行（每天早上8点执行）
0 8 * * * cd /home/node/.openclaw/workspace/ai-news-collector && npm run all >> /tmp/ai-news.log 2>&1
```

## 方案2: 使用 OpenClaw cron（需要 gateway 运行）
```bash
openclaw cron add \
  --name "ai-news-daily" \
  --message "采集今天的AI资讯" \
  --cron "0 0 8 * * *" \
  --description "每天早上8点自动采集AI资讯" \
  --announce \
  --channel feishu
```

## 方案3: 使用 pm2
```bash
npm install -g pm2
pm2 start --name ai-news npm -- run all
pm2 cron ai-news "0 8 * * *"
```

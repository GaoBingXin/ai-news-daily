# AI热点资讯日报 🤖

自动采集全网AI热点资讯，生成精美HTML页面，每天自动更新部署。

## ✨ 功能特性

- **自动采集**: 每天8点自动采集全网AI热点资讯
- **智能过滤**: 只保留AI相关的高质量资讯
- **精美展示**: 现代化设计的HTML页面
- **自动部署**: 自动部署到Vercel，实时可访问
- **分类浏览**: 按公司、技术领域分类展示
- **响应式设计**: 支持手机、平板、电脑访问

## 📊 资讯来源

- 机器之心 (RSS)
- 量子位 (RSS)  
- AI科技大本营 (RSS)
- OpenAI官方博客 (RSS)
- Google AI博客 (RSS)
- Hugging Face博客 (RSS)

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/yourusername/ai-news-collector.git
cd ai-news-collector
```

### 2. 安装依赖
```bash
npm install
```

### 3. 测试采集
```bash
npm run collect
```

### 4. 生成页面
```bash
npm run build
```

### 5. 配置部署
```bash
npm run deploy
```

## ⚙️ 配置说明

### 环境变量
```bash
# Vercel部署Token
export VERCEL_TOKEN="your_vercel_token_here"

# 其他可选配置
export NEWS_LIMIT=50  # 每日资讯数量限制
```

### 定时任务配置（OpenClaw）

在OpenClaw中创建定时任务：
```yaml
任务名称: AI资讯采集
执行时间: 每天8:00
执行命令: cd /path/to/ai-news-collector && npm run all
```

## 📁 项目结构

```
ai-news-collector/
├── scripts/
│   ├── collect-news.js    # 资讯采集脚本
│   ├── generate-html.js   # HTML生成脚本
│   └── deploy.js          # 部署脚本
├── data/
│   ├── latest.json        # 最新资讯数据
│   └── news-YYYY-MM-DD.json  # 每日存档
├── public/
│   └── index.html         # 生成的HTML页面
├── index.js              # 主入口文件
├── package.json          # 项目配置
├── vercel.json           # Vercel部署配置
└── README.md            # 项目说明
```

## 🔧 自定义配置

### 添加资讯来源
编辑 `scripts/collect-news.js` 中的 `sources` 数组：

```javascript
const sources = [
  {
    name: '新来源名称',
    type: 'rss',  // 支持rss/html/api
    url: 'RSS地址'
  }
];
```

### 修改关键词过滤
编辑 `aiKeywords` 数组，添加或删除关键词：

```javascript
const aiKeywords = [
  'ai', '人工智能', '机器学习', 
  // ... 添加你的关键词
];
```

### 调整页面样式
编辑 `scripts/generate-html.js` 中的CSS样式部分。

## 🌐 部署说明

### 自动部署（推荐）
项目已配置自动部署脚本，只需：
1. 推送到GitHub仓库
2. 在Vercel中导入项目
3. 配置环境变量 `VERCEL_TOKEN`

### 手动部署
```bash
# 登录Vercel
vercel login

# 部署到生产环境
vercel --prod
```

## 📈 数据统计

每日采集的数据会保存在 `data/` 目录：
- `latest.json`: 最新10条资讯（用于首页）
- `news-YYYY-MM-DD.json`: 每日完整数据存档

## 🤝 贡献指南

欢迎提交Issue和Pull Request！
1. Fork项目
2. 创建功能分支
3. 提交更改
4. 发起Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 📞 联系支持

如有问题或建议，请：
- 提交 [GitHub Issue](https://github.com/yourusername/ai-news-collector/issues)
- 或通过邮件联系

---

**每天8点，准时获取最新AI资讯！** 🚀

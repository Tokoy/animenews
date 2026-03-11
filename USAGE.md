# 动漫新闻爬虫使用说明

## 功能概览

本项目已修复并优化了原有的爬虫功能，解决了以下问题：

1. **内容和排版问题** - 现在能正确抓取RSS中的guid链接内容，保留图片和文章格式
2. **翻译功能分离** - 翻译功能现在作为独立任务运行，与抓取任务分离

## 使用方法

### 1. 安装依赖

```bash
npm install
```

### 2. 环境配置

创建 `.env` 文件并配置必要参数：

```env
# RSS URL for Japanese Anime News
RSS_URL_JP=https://animeanime.jp/rss20/index.rdf

# GitHub Configuration
GITHUB_ACCESS_TOKEN=your_github_token_here

# AI API Configuration
FREE_API_KEY=your_api_key_here
FREE_API_BASE=https://api.openai.com/v1
MODEL=gpt-3.5-turbo
```

### 3. 运行命令

#### 完整流程（抓取 + 翻译 + 推送）
```bash
npm run crawl
```

#### 仅抓取（不翻译）
```bash
npm run scrape
```

#### 仅翻译（翻译已存在的待翻译文件）
```bash
npm run translate
```

### 4. 文件标记系统

- 新抓取的文章会自动生成 `.needs_translation` 标记文件
- 翻译完成后，标记文件会被自动删除
- 系统只翻译带有标记的文件

### 5. 脚本位置

- `/scripts/scrape_raw_content.js` - 内容抓取脚本
- `/scripts/translate_articles.js` - 翻译脚本  
- `/scripts/main_crawler.js` - 主控制脚本
- `/cron/scrape_job.js` - 独立的抓取任务脚本
- `/cron/translate_job.js` - 独立的翻译任务脚本

## 定时任务配置

参见 `CRON_SETUP.md` 文件了解如何配置定时任务。

## 特性

- ✅ 保留原文图片和HTML格式
- ✅ 正确解析RSS源内容
- ✅ 分离的抓取和翻译流程
- ✅ 自动推送到GitHub
- ✅ 错误处理和重试机制
- ✅ 日志记录
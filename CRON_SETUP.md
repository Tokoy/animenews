# Cron 任务配置说明

## 任务概述

为了实现您的需求，我们设置了两个独立的定时任务：

1. **抓取任务** - 定期抓取最新的动漫新闻
2. **翻译任务** - 对已抓取的待翻译文章进行翻译

## 脚本位置

- `/Users/ike/Documents/animenews/cron/scrape_job.js` - 抓取任务脚本
- `/Users/ike/Documents/animenews/cron/translate_job.js` - 翻译任务脚本

## 配置方法

### 方法1：系统crontab

编辑系统crontab：
```bash
crontab -e
```

添加以下行（根据需要调整时间间隔）：
```bash
# 每30分钟执行一次抓取任务
*/30 * * * * cd /Users/ike/Documents/animenews && node cron/scrape_job.js >> /var/log/anime_scrape.log 2>&1

# 每小时执行一次翻译任务（在抓取任务之后）
0 * * * * cd /Users/ike/Documents/animenews && node cron/translate_job.js >> /var/log/anime_translate.log 2>&1
```

### 方法2：使用node-cron包

如果项目中使用node-cron，可以在主应用中添加：

```javascript
const cron = require('node-cron');
const { scrapeLatestArticles } = require('./scripts/scrape_raw_content');
const { translateAllPendingFiles } = require('./scripts/translate_articles');

// 每30分钟抓取一次
cron.schedule('*/30 * * * *', async () => {
  console.log('执行抓取任务...');
  await scrapeLatestArticles(3);
});

// 每小时翻译一次
cron.schedule('0 * * * *', async () => {
  console.log('执行翻译任务...');
  await translateAllPendingFiles();
});
```

## 手动运行

您也可以手动运行这些任务：

```bash
# 运行完整流程（抓取+翻译）
npm run crawl

# 仅抓取
npm run scrape

# 仅翻译
npm run translate
```

## 文件标记系统

- 新抓取的文章会自动创建 `.needs_translation` 标记文件
- 翻译完成后，标记文件会被删除
- 系统只会翻译带有标记的文件

## 注意事项

1. 确保 `.env` 文件中有正确的API密钥配置
2. 由于API限制，翻译任务可能会比较耗时
3. 建议在翻译任务和抓取任务之间留出时间间隔，避免冲突
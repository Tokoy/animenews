#!/usr/bin/env node

/**
 * 独立的抓取任务脚本
 * 用于cron定时执行文章抓取
 */

const { scrapeLatestArticles } = require('../scripts/scrape_raw_content');
const { pushToGitHub } = require('../scripts/main_crawler');

async function runScrapeJob() {
  console.log('🔄 开始执行定时抓取任务...');
  console.log(new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));

  try {
    // 抓取最新文章（不翻译）
    const scrapedCount = await scrapeLatestArticles(3);
    
    if (scrapedCount > 0) {
      console.log(`✅ 抓取完成: ${scrapedCount} 篇文章`);
      
      // 推送到GitHub
      try {
        await pushToGitHub();
        console.log('✅ 更改已推送到GitHub');
      } catch (pushError) {
        console.error('❌ 推送失败:', pushError.message);
      }
    } else {
      console.log('ℹ️ 没有新文章需要抓取');
    }
  } catch (error) {
    console.error('❌ 抓取任务失败:', error);
    process.exit(1);
  }
}

// 执行任务
runScrapeJob().catch(error => {
  console.error('任务执行出错:', error);
  process.exit(1);
});
#!/usr/bin/env node

const { scrapeLatestArticles } = require('./scrape_raw_content');
const { translateAllPendingFiles } = require('./translate_articles');
const { exec } = require('child_process');
const fs = require('fs');

/**
 * 推送更改到GitHub
 */
function pushToGitHub() {
  return new Promise((resolve, reject) => {
    console.log('正在推送更改到GitHub...');
    exec('git add . && git commit -m "feat: 更新动漫新闻文章" && git push origin main', 
      (error, stdout, stderr) => {
        if (error) {
          console.error('Git操作失败:', error);
          reject(error);
          return;
        }
        console.log('成功推送到GitHub');
        resolve(stdout);
      }
    );
  });
}

/**
 * 运行完整流程：抓取 -> 翻译 -> 推送
 */
async function runFullPipeline() {
  console.log('🚀 开始运行动漫新闻爬虫完整流程...\n');
  
  // 1. 抓取最新文章
  console.log('1. 开始抓取最新文章...');
  const scrapedCount = await scrapeLatestArticles(3);
  
  if (scrapedCount > 0) {
    console.log(`\n2. 开始翻译 ${scrapedCount} 篇新文章...`);
    
    // 2. 翻译新抓取的文章
    const translatedCount = await translateAllPendingFiles();
    
    console.log(`\n3. 推送更新到GitHub...`);
    
    // 3. 推送更改到GitHub
    try {
      await pushToGitHub();
      console.log('\n✅ 完整流程执行成功！');
      console.log(`📊 统计: 抓取 ${scrapedCount}, 翻译 ${translatedCount}, 已推送`);
    } catch (error) {
      console.error('\n❌ 推送失败，但文章已处理完成');
      console.error('错误详情:', error.message);
    }
  } else {
    console.log('⚠️ 没有新文章需要处理');
  }
}

/**
 * 只抓取不翻译
 */
async function runScrapeOnly() {
  console.log('🔄 开始只抓取文章（不翻译）...');
  const scrapedCount = await scrapeLatestArticles(3);
  console.log(`📊 抓取完成: ${scrapedCount} 篇文章`);
}

/**
 * 只翻译不抓取
 */
async function runTranslateOnly() {
  console.log('🔄 开始只翻译现有文章...');
  const translatedCount = await translateAllPendingFiles();
  console.log(`📊 翻译完成: ${translatedCount} 篇文章`);
}

// 解析命令行参数
const args = process.argv.slice(2);
const mode = args[0] || 'full'; // 默认执行完整流程

// 运行相应的模式
switch(mode) {
  case 'full':
    runFullPipeline().catch(console.error);
    break;
  case 'scrape-only':
    runScrapeOnly().catch(console.error);
    break;
  case 'translate-only':
    runTranslateOnly().catch(console.error);
    break;
  default:
    console.log('用法:');
    console.log('  node main_crawler.js                    # 完整流程（抓取+翻译+推送）');
    console.log('  node main_crawler.js scrape-only       # 仅抓取');
    console.log('  node main_crawler.js translate-only    # 仅翻译');
    break;
}
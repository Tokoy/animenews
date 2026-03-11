#!/usr/bin/env node

/**
 * 独立的翻译任务脚本
 * 在抓取任务完成后执行翻译
 */

const { translateAllPendingFiles } = require('../scripts/translate_articles');
const { pushToGitHub } = require('../scripts/main_crawler');

async function runTranslateJob() {
  console.log('🔄 开始执行定时翻译任务...');
  console.log(new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));

  try {
    // 翻译所有待翻译的文章
    const translatedCount = await translateAllPendingFiles();
    
    if (translatedCount > 0) {
      console.log(`✅ 翻译完成: ${translatedCount} 篇文章`);
      
      // 推送到GitHub
      try {
        await pushToGitHub();
        console.log('✅ 翻译更改已推送到GitHub');
      } catch (pushError) {
        console.error('❌ 推送失败:', pushError.message);
      }
    } else {
      console.log('ℹ️ 没有待翻译的文章');
    }
  } catch (error) {
    console.error('❌ 翻译任务失败:', error);
    process.exit(1);
  }
}

// 执行任务
runTranslateJob().catch(error => {
  console.error('任务执行出错:', error);
  process.exit(1);
});
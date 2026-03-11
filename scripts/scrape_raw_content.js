const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { XMLParser } = require("fast-xml-parser");
const moment = require('moment');

require('dotenv').config();

/**
 * 从RSS获取文章列表
 */
async function getRssArticles() {
  const rssUrl = `${process.env.RSS_URL_JP}`;
  try {
    const response = await axios.get(rssUrl);
    const parser = new XMLParser();
    const jsonData = parser.parse(response.data);
    return jsonData.rss.channel.item; // 返回所有文章，不只是第一个
  } catch (error) {
    console.error('获取RSS失败:', error);
    return [];
  }
}

/**
 * 抓取单篇文章的原始内容
 */
async function scrapeArticleContent(item) {
  try {
    const response = await axios.get(item.link);
    const $ = cheerio.load(response.data);

    // 提取文章主体内容
    const articleBody = $("article.arti-body.cf.cXenseParse.editor-revolution").first();
    
    // 移除不需要的元素
    articleBody.find('.af_box').remove();
    articleBody.find('script').remove();
    articleBody.find('.cXenseParse').remove(); // 移除广告相关内容
    
    // 获取清理后的内容
    const bodyHtml = articleBody.html();
    
    // 提取作者
    const author = $("span.writer.writer-name").text().trim() || 'Anime News';
    
    // 提取封面图
    const cover = $('meta[name="twitter:image"]').attr('content') || 
                  $('meta[property="og:image"]').attr('content') ||
                  '';
    
    // 提取描述
    const description = $('meta[name="description"]').attr('content') || 
                        $('meta[property="og:description"]').attr('content') ||
                        item.description || item.title.substring(0, 150) + '...';
    
    return {
      title: item.title,
      pubDate: item.pubDate,
      description: description,
      author: author,
      cover: cover,
      body: bodyHtml,
      link: item.link,
      guid: item.guid || item.link
    };
  } catch (error) {
    console.error(`抓取文章内容失败 ${item.link}:`, error);
    return null;
  }
}

/**
 * 创建原始内容的Markdown文件
 */
function createRawMarkdown(article) {
  const pubDate = moment(article.pubDate).toISOString();
  const timestamp = moment().format('YYYYMMDD_HHmmss');
  const slug = `${timestamp}_${Math.random().toString(36).substring(2, 10)}`;
  
  // 创建基础的markdown模板
  const markdown = `---
layout: '../../layouts/MarkdownPost.astro'
title: '${article.title}'
pubDate: ${pubDate}
description: '${article.description}'
author: '${article.author}'
cover:
  url: '${article.cover}'
  square: '${article.cover}'
  alt: "cover"
tags: ['animenews','anime','动漫资讯']
theme: 'light'
featured: false
---
${article.cover ? `![cover](${article.cover})\n\n` : ''}
${article.body}

> [原文地址](${article.link})

`;

  return {
    content: markdown,
    filename: `${slug}.md`,
    needsTranslation: true
  };
}

/**
 * 保存文章到本地
 */
function saveArticleToFile(articleData) {
  const filePath = `src/pages/posts/${articleData.filename}`;
  fs.writeFileSync(filePath, articleData.content);
  console.log(`已保存文章: ${filePath}`);
  
  // 创建标记文件，表示需要翻译
  if (articleData.needsTranslation) {
    const markerFilePath = `${filePath}.needs_translation`;
    fs.writeFileSync(markerFilePath, '');
    console.log(`已创建翻译标记: ${markerFilePath}`);
  }
}

/**
 * 主函数 - 抓取最新文章
 */
async function scrapeLatestArticles(limit = 3) {
  console.log('开始获取RSS文章...');
  const articles = await getRssArticles();
  
  if (!articles || articles.length === 0) {
    console.log('没有获取到文章');
    return;
  }
  
  console.log(`获取到 ${articles.length} 篇文章，正在处理最新 ${limit} 篇...`);
  
  let processedCount = 0;
  for (let i = 0; i < Math.min(limit, articles.length); i++) {
    console.log(`处理第 ${i+1}/${Math.min(limit, articles.length)} 篇文章...`);
    
    const articleData = await scrapeArticleContent(articles[i]);
    if (articleData) {
      const markdownData = createRawMarkdown(articleData);
      saveArticleToFile(markdownData);
      processedCount++;
      
      // 添加延迟避免请求过于频繁
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log(`跳过文章: ${articles[i].title}`);
    }
  }
  
  console.log(`完成！共处理 ${processedCount} 篇文章`);
  return processedCount;
}

// 如果直接运行此脚本
if (require.main === module) {
  scrapeLatestArticles(3)
    .then(() => {
      console.log('文章抓取完成！');
    })
    .catch(console.error);
}

module.exports = {
  scrapeLatestArticles,
  getRssArticles,
  scrapeArticleContent,
  createRawMarkdown,
  saveArticleToFile
};
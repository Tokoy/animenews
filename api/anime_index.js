const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { Configuration, OpenAIApi } = require("openai");
const bodyParser = require('body-parser');
const { XMLParser} = require("fast-xml-parser");
const app = express();
const port = 3005;
const moment = require('moment');
require('dotenv').config();
const splitIntoSentences = require('sentence-splitter');
global.updated = " ";

app.get('/', (req, res) => {
  const content = req.query.content;
  const data = {msg: `Hello, This is test API! ${content}`};
  console.log(req.body);
  res.status(200).send(data);
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const prompt1 = "你是一个日本动漫资讯的编辑，你需要执行下面的步骤对文本进行处理: 1.把html转换成markdown格式,需要保留imgs图片地址。2.将文章翻译成中文,人名和作品名称不需要翻译。"
const template = `---
layout: '../../layouts/MarkdownPost.astro'
title: '中文标题'
pubDate: 日期为YYYY-MM-DDThh:mm:ssZ
description: '中文描述'
author: '作者名称'
cover:
  url: '替换为https://animeanime.jp/imgs/ogp_f/的图片'
  square: '替换为https://animeanime.jp/imgs/ogp_f/的图片'
  alt: "cover"
tags: ['news','anime']
theme: 'light'
featured: false
---
![cover](替换为https://animeanime.jp/imgs/ogp_f/的图片)
`;
const prompt2 = `依次执行下面的步骤：1.翻译日文成中文，人名和作品名称不需要翻译。2.把html的文本提取出来，保留imgs图片地址。3.按照模板里填写中文标题、日期、中文描述、作者名称和图片,保持模板格式不变: ${template}`

// 通过axios获取RSS地址
async function getRssUrl() {
  const rssUrl = `${process.env.RSS_URL_JP}`;
  try {
    const response = await axios.get(rssUrl);
    const parser = new XMLParser();
    const jsonData = parser.parse(response.data);//获取到了所有的rss的entry，返回string[]
    const items = jsonData.rss.channel.item[0]; //获取第一个items
    const updated = items.pubDate;
    if (updated != global.updated) {
      global.updated = updated;
      return items;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
}

// 通过axios获取HTML内容并使用cheerio解析
async function scrapeData(items){
  const response = await axios.get(items.link);
  const $ = cheerio.load(response.data);
  const link = `>[原文地址](${items.link})  `;
  const html = $("article.arti-body.cf.cXenseParse.editor-revolution").clone();
  html.find('.af_box').remove();
  html.find('script').remove();
  const body = html.html();
  const writer = $("span.writer.writer-name").html();
  const cover = $('meta[name="twitter:image"]').attr('content');
  const head = cover+JSON.stringify(items)+writer;
  const tphead = await steamgpt(head,prompt2);
  const mdbody = await splitSentences(body);

  if (tphead != null) {
    const full = tphead + '\n' + mdbody + '\n' + '\n'+ link;
    return full;
  }
  else{
    return null;
  }
}

//上传文件到github上
async function pushmd(markdowndata,filename){
  // 上传的文件内容
  const fileContent = markdowndata;

  // 仓库拥有者、仓库名和分支名
  const owner = 'Tokoy';
  const repo = 'animenews';
  const branch = 'main';

  // 文件路径和文件名，注意要使用斜杠分隔路径
  const fileName = filename;
  const filePath = `src/pages/posts/${fileName}`;

  // GitHub API 路径
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  // 构造 HTTP 请求头，包含授权信息和 Accept 头部
  const headers = {
    Authorization: `token ${process.env.GITHUB_ACCESS_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
  };

  // 构造提交数据，包含文件名、文件内容和分支名
  const data = {
    message: `Add file ${fileName}`,
    content: Buffer.from(fileContent).toString('base64'),
    branch: branch,
  };
  // 发送 PUT 请求，创建或更新文件
  axios.put(apiUrl, data, { headers })
  .then(response => {
    console.log(`File ${fileName} uploaded to GitHub.`);
  })
  .catch(error => {
    console.error(`Failed to upload file ${fileName} to GitHub:`, error);
  });
}

//分割文章
async function splitSentences(text){
  // 拆分为句子
  const sentences = splitIntoSentences.split(text)

  const segmentSize = 10; // 每段包含的句子数量
  let segments = [];
  let currentSegment = [];
  for (let i = 0, len = sentences.length; i < len; i++) {
    currentSegment.push(sentences[i]);
    if (currentSegment.length === segmentSize) {
      segments.push(currentSegment);
      currentSegment = [];
    }
  }

  let article = "";
  // 输出拆分结果
  for (let [index, segment] of segments.entries()) {
    const text = segment.map((sentence) => sentence.raw).join(' ');
    //console.log(`第 ${index + 1} 段：${text}`);
    let msg = await steamgpt(text,prompt1);
    article = article + "\n" + msg;
    await setTimeout(() => {}, 1000);
    //console.log(article);
  }

  return article
}

//用openapi的流模式翻译
async function steamgpt(content,prompt) {
  const configuration = new Configuration({
    apiKey: `${process.env.FREE_API_KEY}`,
    basePath: `${process.env.FREE_API_BASE}`
  });
  // OpenAI instance creation
  const openai = new OpenAIApi(configuration);

  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {"role": "system", "content": `${prompt}`},
        {"role": "user", "content": `${content}`},
      ],
      temperature: 0,
      stream: true,
  }, { responseType: 'stream' });
  const stream = completion.data;
  return new Promise((resolve, reject) => {
    const payloads = [];
    let sentence = ''; // 用于存储组成的句子
    stream.on('data', (chunk) => {
      const data = chunk.toString();
      payloads.push(data);
    });

    stream.on('end', () => {
      const data = payloads.join(''); // 将数组中的数据拼接起来
      const chunks = data.split('\n\n');
      for (const chunk of chunks) {
        if (chunk.includes('[DONE]')) return;
        if (chunk.startsWith('data:')) {
          const payload = JSON.parse(chunk.replace('data: ', ''));
          try {
            const chunk = payload.choices[0].delta?.content;
            if (chunk) {
              sentence += chunk; // 将单词添加到句子中
            }

          } catch (error) {
            console.log(`Error with JSON.parse and ${chunk}.\n${error}`);
            reject(error);
          }
        }
      }
    });
    stream.on('error', (err) => {
        console.log(err);
    });
    stream.on('close', () => {
      resolve(sentence);
  });
  })
  } catch (err) {
    console.log(err);
  }
}

function deleteFile(filePath) {
  fs.unlink(filePath, (error) => {
    if (error) {
      console.error(error);
    } else {
      console.log(`文件 ${filePath} 已成功删除`);
    }
  });
}


function checkBuild(ch) {
  const timestamp = moment().format('YYYYMMDDHHmm');
  fs.writeFileSync(`src/pages/posts/${timestamp}.md`, ch);
  return new Promise((resolve) => {
    exec('npm run build', (error, stdout, stderr) => {
      if (error) {
        // 如果执行命令出错，返回false
        console.log(`构建失败，删除文章`)
        fs.unlink(`src/pages/posts/${timestamp}.md`)
      } else {
        // 如果命令执行成功且没有错误输出，返回true
        if (!stderr) {
          console.log(`构建成功，开始上传`)
          pushmd(ch,`${timestamp}.md`); //push到github
        } else {
          // 如果命令执行成功但有错误输出，返回false
          console.log(`构建错误，删除文章`)
          fs.unlink(`src/pages/posts/${timestamp}.md`)
        }
      }
    });
  });
}

//定时任务
const intervalId = setInterval(() => {
  getRssUrl().then(url => {
    if(url != undefined){
      //获取文章内容
      scrapeData(url).then(ch =>{
        //ai转换为markdown格式
          if(ch != null || ch != undefined){
            console.log(`检查到新的文章：${url}`);
            //测试新生成的文件是否可以编译成功
            checkBuild(ch);
          }
      });
    }
  });
}, 300000);

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

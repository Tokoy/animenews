const fs = require('fs');
const path = require('path');
const { Configuration, OpenAIApi } = require("openai");

require('dotenv').config();

const promptTemplate = `你是一个专业的日中翻译编辑，请执行以下步骤：
1. 将日文内容准确翻译成中文，保持原文意思不变
2. 保留所有HTML标签和图片引用，不要修改图片路径
3. 人名、作品名、专有名词保持原文不翻译
4. 将内容整理为标准的markdown格式
5. 翻译标题、描述等metadata字段

原始内容：
{CONTENT}`;

/**
 * 获取需要翻译的文件列表
 */
function getFilesNeedingTranslation(postsDir = './src/pages/posts/') {
  const files = fs.readdirSync(postsDir);
  const needsTranslationFiles = files.filter(file => 
    file.endsWith('.md.needs_translation')
  );
  
  return needsTranslationFiles.map(file => {
    const originalFile = file.replace('.needs_translation', '');
    return {
      translationMarker: path.join(postsDir, file),
      originalFile: path.join(postsDir, originalFile),
      originalFileName: originalFile
    };
  });
}

/**
 * 读取文件内容
 */
function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`读取文件失败 ${filePath}:`, error);
    return null;
  }
}

/**
 * 写入文件内容
 */
function writeFileContent(filePath, content) {
  try {
    fs.writeFileSync(filePath, content);
    console.log(`已更新文件: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`写入文件失败 ${filePath}:`, error);
    return false;
  }
}

/**
 * 使用OpenAI API翻译内容
 */
async function translateContent(content, retries = 3) {
  const configuration = new Configuration({
    apiKey: `${process.env.FREE_API_KEY}`,
    basePath: `${process.env.FREE_API_BASE}`
  });
  
  const openai = new OpenAIApi(configuration);
  const prompt = promptTemplate.replace('{CONTENT}', content);

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`开始翻译，尝试 ${attempt + 1}/${retries}...`);
      
      const completion = await openai.createChatCompletion({
        model: `${process.env.MODEL}` || "gpt-3.5-turbo",
        messages: [
          {"role": "system", "content": "你是一个专业的日中翻译编辑，专注于动漫资讯的翻译。请准确翻译日文内容为中文，保留所有HTML标签和图片路径，人名和作品名保持原文。"},
          {"role": "user", "content": prompt},
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const translatedContent = completion.data.choices[0].message.content.trim();
      return translatedContent;
      
    } catch (error) {
      console.error(`翻译失败 (尝试 ${attempt + 1}/${retries}):`, error.message);
      if (attempt === retries - 1) {
        throw error;
      }
      // 等待一段时间再重试
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * 更新文件的翻译状态
 */
function markAsTranslated(markerFilePath, success = true) {
  try {
    if (success && fs.existsSync(markerFilePath)) {
      fs.unlinkSync(markerFilePath); // 删除标记文件
      console.log(`已移除翻译标记: ${markerFilePath}`);
    }
  } catch (error) {
    console.error(`更新翻译状态失败 ${markerFilePath}:`, error);
  }
}

/**
 * 翻译单个文件
 */
async function translateSingleFile(fileInfo) {
  console.log(`正在翻译: ${fileInfo.originalFileName}`);
  
  // 读取原文件内容
  const content = readFileContent(fileInfo.originalFile);
  if (!content) {
    console.log(`跳过文件（无法读取）: ${fileInfo.originalFile}`);
    return false;
  }

  try {
    // 执行翻译
    const translatedContent = await translateContent(content);
    
    // 写回翻译后的内容
    const success = writeFileContent(fileInfo.originalFile, translatedContent);
    
    if (success) {
      // 标记为已翻译
      markAsTranslated(fileInfo.translationMarker, true);
      console.log(`完成翻译: ${fileInfo.originalFileName}`);
      return true;
    } else {
      console.log(`翻译失败（写入问题）: ${fileInfo.originalFileName}`);
      return false;
    }
  } catch (error) {
    console.error(`翻译过程出错 ${fileInfo.originalFile}:`, error);
    return false;
  }
}

/**
 * 批量翻译所有需要翻译的文件
 */
async function translateAllPendingFiles() {
  console.log('开始查找需要翻译的文件...');
  
  const filesToTranslate = getFilesNeedingTranslation();
  
  if (filesToTranslate.length === 0) {
    console.log('没有找到需要翻译的文件');
    return 0;
  }
  
  console.log(`找到 ${filesToTranslate.length} 个需要翻译的文件`);
  
  let successCount = 0;
  for (let i = 0; i < filesToTranslate.length; i++) {
    console.log(`\n处理第 ${i+1}/${filesToTranslate.length} 个文件...`);
    
    const success = await translateSingleFile(filesToTranslate[i]);
    if (success) {
      successCount++;
    }
    
    // 添加延迟避免API请求过于频繁
    if (i < filesToTranslate.length - 1) {
      console.log('等待2秒后继续下一个文件...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`\n翻译完成！成功: ${successCount}/${filesToTranslate.length}`);
  return successCount;
}

// 如果直接运行此脚本
if (require.main === module) {
  translateAllPendingFiles()
    .then(count => {
      console.log(`总共翻译了 ${count} 个文件`);
    })
    .catch(console.error);
}

module.exports = {
  translateAllPendingFiles,
  getFilesNeedingTranslation,
  translateSingleFile,
  markAsTranslated
};
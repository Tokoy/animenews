#!/bin/bash

# 定时抓取动画新闻脚本
# 每天北京时间 9:00、15:00、21:00 执行

cd /Users/ike/Documents/animenews || exit 1

# 设置环境变量
export NODE_ENV=production
export RSS_URL_JP="https://animeanime.jp/rss20/index.rdf"

# 记录日志
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始执行抓取任务..." >> cron/scrape_cron.log

# 运行抓取脚本
node cron/scrape_job.js

# 检查是否成功
if [ $? -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 抓取任务成功完成。" >> cron/scrape_cron.log
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 抓取任务失败！" >> cron/scrape_cron.log
fi

# 添加权限
chmod +x cron/scrape_job.js
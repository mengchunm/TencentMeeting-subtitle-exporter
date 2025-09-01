# 腾讯会议字幕导出 (TencentMeeting-subtitle-exporter)

一个基于 **Tampermonkey** 的用户脚本，用于在 [腾讯会议](https://meeting.tencent.com) 的回放页面中 **一键导出字幕** 并保存为 **SRT 格式** 文件，方便二次使用或存档。

---

## ✨ 功能特性
- 自动识别字幕内容并合并
- 支持完整导出为标准 **SRT 字幕格式**
- 内置进度条，显示加载状态
- 一键下载 `.srt` 文件
- 无需复杂操作，开箱即用

---

## 📦 安装
1. 安装 [脚本猫 浏览器扩展](https://scriptcat.org/zh-CN)  
2. 点击安装脚本：[Raw 脚本链接](https://raw.githubusercontent.com/mengchunm/TencentMeeting-subtitle-exporter/main/TencentMeeting-subtitle-exporter.user.js)  
3. 打开腾讯会议的回放页面（URL 形如 `https://meeting.tencent.com/cw/*`）  
4. 页面右侧会出现 **“导出SRT字幕”** 按钮，即可使用  

---

## 🖼️ 使用示例

1. 进入腾讯会议的回放页面  
2. 点击 **导出SRT字幕** → 等待进度条完成  
3. 点击 **下载字幕**，即可得到 `.srt` 文件  

---

## 📝 SRT 示例
```srt
1
00:00:01,200 --> 00:00:03,400
大家好，欢迎参加今天的会议。

2
00:00:03,400 --> 00:00:13,951
高兴今天来跟大家交流一下关于 python 应用开发
00:00:04,000 --> 00:00:06,500
接下来由我来进行分享。

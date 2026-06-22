<h1 align="center">AI Chat Quick jump</h1>

<p align="center">
  <strong>便捷，美观的AI对话导航收藏插件</strong>
</p>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/English-README-green"></a>
  <a href="README_CN.md"><img src="https://img.shields.io/badge/中文-README-blue"></a>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</p>

---

### 官方网站

- [www.aichatjump.click](http://www.aichatjump.click)

---

### 不使用 AI Chat Quick jump

在使用AI 聊天工具时：

- **找不到重点**，重要的对话内容淹没在长长的聊天记录中
- **对话太长，浪费时间**，想回看之前的某个问题，却要不停滚动鼠标，在冗长的对话中反复上下翻找

**AI Chat Quick jump** 就是为了解决这些问题而生！让您可以在 AI 对话页面中**快速定位、标记收藏重点**任何一条提问和回答。

### AI Chat Quick jump 核心功能

#### 右侧历史对话导航条
- 页面右侧会出现一列小圆点，每一个都代表你在当前对话里发过的一次提问
- **鼠标悬停**即可预览提问内容
- **点击小圆点**立即跳转到对应位置，并高亮显示
- 自动跟踪当前浏览位置，右侧的小圆点会自动跟随当前这条提问

#### 智能标记收藏功能
- **长按节点 0.5 秒**即可标记重要对话，标记后自动加入收藏夹。
- **底部收藏按钮**快速打开：查看收藏列表并跳转原始对话。
- **支持自定义收藏标题**：让重点内容更易管理。
- **跨平台同步收藏**：Gemini、ChatGPT、DeepSeek 等多个 AI 平台共享你的收藏记录。

#### 快捷键支持
- **Alt + W / Alt + S**：快速切换上一个/下一个回答
- **Alt + A**：标记/取消标记当前对话（重点内容一目了然）
- **Alt + D**：显示/隐藏右侧历史对话导航条（需要专注时可以收起）
- 支持 Mac 和 Windows 系统，快捷键可自定义

#### 多样主题
- 支持**自动/浅色/深色/天蓝色/薰衣草/粉红/橘黄**多种主题模式
- 新增**未来/圣诞**动态主题

---

#### 多平台支持

| 平台 | 访问域名 |
| --- | --- |
| <img src="public/icons/chatgpt.ico" width="18" alt="ChatGPT"> ChatGPT | `chatgpt.com` |
| <img src="public/icons/claude.webp" width="18" alt="Claude"> Claude | `claude.ai` |
| <img src="public/icons/gemini.webp" width="18" alt="Gemini"> Gemini | `gemini.google.com` |
| <img src="public/icons/deepseek.ico" width="18" alt="DeepSeek"> DeepSeek | `chat.deepseek.com` |
| <img src="public/icons/grok.svg" width="18" alt="Grok"> Grok | `grok.com` |
| <img src="public/icons/qwen.png" width="18" alt="Qwen"> Qwen | `qianwen.com` |
| <img src="public/icons/kimi.png" width="18" alt="Kimi"> Kimi | `kimi.com` |
| <img src="public/icons/doubao.png" width="18" alt="豆包"> 豆包 | `doubao.com` |
| <img src="public/icons/chatglm.png" width="18" alt="ChatGLM"> ChatGLM | `chatglm.cn` |

支持自定义 URL，可在设置中添加其他 AI 聊天网站。

---

### 安装

#### Chrome 网上插件商店（推荐）
[![chrome-extension](https://img.shields.io/badge/Install_on-Chrome-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/aichat-quickjump-%E6%A0%87%E8%AE%B0%E6%94%B6%E8%97%8F%E5%B9%B6%E5%BF%AB%E9%80%9F%E8%B7%B3/pghjaalonebkkelmencpmaieglpfehfp)

#### Edge 网上插件商店（推荐）
[![edge-extension](https://img.shields.io/badge/Install_on-Edge-0078D7?logo=microsoft-edge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/ai-chat-quick-jump/hffbnbdeddbimnmgbbdhlhjbmkflpnpo)

---

#### 本地开发
1. 克隆或下载本项目代码
2. 在项目根目录执行：
   ```bash
   npm install
   npm run build
   ```
3. 打开 Chrome 浏览器，进入 `chrome://extensions/`
4. 开启右上角的"开发者模式"
5. 点击"加载已解压的扩展程序"，选择项目中的 `dist` 文件夹

---

### 技术与许可证

本扩展基于 **TypeScript** 和 **Chrome Extension Manifest V3** 开发，采用轻量级架构，数据存储在本地。项目使用 **MIT** 许可证。

---

<h1 align="center">AI Chat Quick jump</h1>

<p align="center">
  <strong>The most elegant & efficient navigator / favorites extension for AI chats</strong>
</p>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/中文-README-blue"></a>
  <a href="README_EN.md"><img src="https://img.shields.io/badge/English-README-green"></a>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/ChatGPT-74aa9c?logo=openai&logoColor=white" alt="ChatGPT">
  <img src="https://img.shields.io-badge/Claude-191919?logo=anthropic&logoColor=white" alt="Claude">
  <img src="https://img.shields.io/badge/Gemini-8E75B2?logo=google&logoColor=white" alt="Gemini">
  <img src="https://img.shields.io/badge/DeepSeek-4285F4?logo=deepseek&logoColor=white" alt="DeepSeek">
</p>

---

### 👍 Official Website – Learn everything quickly

- [www.aichatjump.click](http://www.aichatjump.click)

### ❌ Without AI Chat Quick jump

When using AI chat tools like ChatGPT, Claude, Gemini, DeepSeek, Grok and others:

- 💬 **Conversations are too long** – you want to review a previous question but must scroll endlessly
- 🔍 **Key content is hard to find** – important messages are buried in a massive chat history
- ⏱️ **Time is wasted** – constantly scrolling up and down through the same conversation

**AI Chat Prompt jump** was created to solve these problems. It is a browser extension that lets you **quickly locate, pin, and favorite** any question & answer on AI chat pages.

### ✅ Core Features of AI Chat Quick jump

#### 🎯 Right-side conversation timeline

- A vertical line of small dots appears on the **right side** of the page, each dot represents one prompt you sent in the current conversation
- **Hover a dot** to preview the prompt content
- **Click a dot** to instantly scroll to that message and highlight it
- The active dot automatically follows your current reading position while you scroll

#### 📌 Smart pin & favorites

- **Long-press a dot for 0.5 seconds** to pin important messages; pinned items are automatically added to your favorites list
- 📁 **Bottom “★★★” button** opens the favorites panel: browse all your saved conversations and jump back to the original messages
- ✏️ **Editable favorite title**: make your saved items easier to recognize and manage
- 🔄 **Cross-site favorites sync**: share the same favorites list across ChatGPT, Grok and other supported AI platforms

#### ⌨️ Powerful keyboard shortcuts

- **Alt + W / Alt + S**: Jump to previous / next answer
- **Alt + A**: Pin / unpin the current node (highlight important content)
- **Alt + D**: Show / hide the right-side timeline panel (collapse when you need focus)
- Works on both macOS and Windows, and shortcuts can be customized

#### 🎨 Theme-aware UI

- Supports multiple themes: **Auto / Light / Dark / Sky Blue / Lavender / Pink / Orange**
- Clean, minimal UI that stays out of the way of your content

#### 🌐 Multi-platform support

- ✅ **ChatGPT** (chatgpt.com)
- ✅ **Claude** (claude.ai)
- ✅ **Gemini** (gemini.google.com)
- ✅ **DeepSeek** (chat.deepseek.com)
- ✅ **Grok** (grok.com)
- 🔧 Supports **custom URLs** (add other AI chat websites in the options page)

### 🚀 Installation

#### Chrome Web Store (Recommended)

Coming soon...

#### Microsoft Edge Add-ons (Recommended)

[![edge-extension](https://img.shields.io/badge/Install_on-Edge-0078D7?logo=microsoft-edge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/ai-chat-quick-jump/hffbnbdeddbimnmgbbdhlhjbmkflpnpo)

#### Manual installation (Developer Mode)

1. Clone or download this repository
2. In the project root, run:
   ```bash
   npm install
   npm run build
   ```
3. Open Chrome (or Edge) and go to `chrome://extensions/` (or `edge://extensions/`)
4. Enable **Developer mode** in the top-right corner
5. Click **Load unpacked** and select the `dist` folder in this project

### 🛠️ Technical details

This extension is built with **TypeScript** and **Chrome Extension Manifest V3**, using a lightweight architecture that minimizes impact on page performance. All data is stored locally to help protect your privacy.

### 📄 License

MIT

---

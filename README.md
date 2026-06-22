<h1 align="center">AI Chat Quick jump</h1>

<p align="center">
  <strong>The most elegant & efficient navigator / favorites extension for AI chats</strong>
</p>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/English-README-green"></a>
  <a href="README_CN.md"><img src="https://img.shields.io/badge/中文-README-blue"></a>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</p>

---

### Official Website

- [www.aichatjump.click](http://www.aichatjump.click)

---

### Without AI Chat Quick jump

When chat with AI:

- **Conversations are too long** – you want to review a previous question but must scroll endlessly
- **Key content is hard to find** – important messages are buried in a massive chat history
- **Time is wasted** – constantly scrolling up and down through the same conversation

**AI Chat Quick jump** was created to solve these problems. It is a browser extension that lets you **quickly locate, pin, and favorite** any question & answer on AI chat pages.

### Core Features of AI Chat Quick jump

#### Right-side conversation timeline

- A vertical line of small dots appears on the **right side** of the page, each dot represents one prompt you sent in the current conversation
- **Hover a dot** to preview the prompt content
- **Click a dot** to instantly scroll to that message and highlight it
- The active dot automatically follows your current reading position while you scroll

#### Smart pin & favorites

- **Long-press a dot for 0.5 seconds** to pin important messages; pinned items are automatically added to your favorites list
- **Bottom favorites button** opens the favorites panel: browse all your saved conversations and jump back to the original messages
- **Editable favorite title**: make your saved items easier to recognize and manage
- **Cross-site favorites sync**: share the same favorites list across Gemini, ChatGPT, DeepSeek and other supported AI platforms

#### Powerful keyboard shortcuts

- **Alt + W / Alt + S**: Jump to previous / next answer
- **Alt + A**: Pin / unpin the current node (highlight important content)
- **Alt + D**: Show / hide the right-side timeline panel (collapse when you need focus)
- Works on both macOS and Windows, and shortcuts can be customized

#### Theme-aware UI

- Supports multiple themes: **Auto / Light / Dark / Sky Blue / Lavender / Pink / Orange**
- New Dynamic Theme: **Future/Christmas**

---

#### Multi-platform support

| Platform | Domain |
| --- | --- |
| <img src="public/icons/chatgpt.ico" width="18" alt="ChatGPT"> ChatGPT | `chatgpt.com` |
| <img src="public/icons/claude.webp" width="18" alt="Claude"> Claude | `claude.ai` |
| <img src="public/icons/gemini.webp" width="18" alt="Gemini"> Gemini | `gemini.google.com` |
| <img src="public/icons/deepseek.ico" width="18" alt="DeepSeek"> DeepSeek | `chat.deepseek.com` |
| <img src="public/icons/grok.svg" width="18" alt="Grok"> Grok | `grok.com` |
| <img src="public/icons/qwen.png" width="18" alt="Qwen"> Qwen | `qianwen.com` |
| <img src="public/icons/kimi.png" width="18" alt="Kimi"> Kimi | `kimi.com` |
| <img src="public/icons/doubao.png" width="18" alt="Doubao"> Doubao | `qdoubao.com` |
| <img src="public/icons/chatglm.png" width="18" alt="ChatGLM"> ChatGLM | `chatglm.cn` |

Custom URLs are supported, so you can add other AI chat websites in the options page.

---

### Installation

#### Chrome Web Store (Recommended)

[![chrome-extension](https://img.shields.io/badge/Install_on-Chrome-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/aichat-quickjump-%E6%A0%87%E8%AE%B0%E6%94%B6%E8%97%8F%E5%B9%B6%E5%BF%AB%E9%80%9F%E8%B7%B3/pghjaalonebkkelmencpmaieglpfehfp)

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

---

### Tech and License

This extension is built with **TypeScript** and **Chrome Extension Manifest V3**. It uses a lightweight architecture, stores data locally, and is released under the **MIT** license.

---

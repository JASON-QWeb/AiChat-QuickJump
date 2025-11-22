# 🧭 LLM Answer Navigator

一个 Chrome 浏览器扩展，用于在大语言模型对话页面中快速导航 AI 回答。

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)

## ✨ 功能特性

- 🎯 **智能识别**：自动识别页面上所有 AI 回答
- 🔄 **快速导航**：通过浮动面板或快捷键在回答间跳转
- 🎨 **视觉高亮**：跳转时自动高亮当前回答
- ⌨️ **键盘快捷键**：
  - **Windows/Linux**: `Alt + ↑` / `Alt + ↓`
  - **Mac**: `Option (⌥) + ↑` / `Option (⌥) + ↓`
- 🌓 **跟随系统主题**：默认自动适配浏览器浅色/深色模式
- 🎨 **多种主题**：支持绿色、薰衣草紫、暗色、亮色等主题
- ⚙️ **可配置**：通过设置页面自定义功能

## 🌐 支持的网站

- ✅ **ChatGPT** (chatgpt.com, chat.openai.com)
- 📋 更多站点正在开发中...

想要添加新站点支持？查看 [适配器开发指南](./ADAPTER_GUIDE.md)

## 📦 安装方法

### 本地开发安装

1. **克隆仓库**
   ```bash
   git clone <repository-url>
   cd llm-answer-navigator
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建扩展**
   ```bash
   npm run build
   ```

4. **加载到 Chrome**
   - 打开 Chrome 浏览器
   - 访问 `chrome://extensions/`
   - 启用右上角的「开发者模式」
   - 点击「加载已解压的扩展程序」
   - 选择项目中的 `dist` 目录

## 🎮 使用方法

1. **访问支持的网站**（如 ChatGPT）
2. **查看浮动面板**：在页面右下角会出现导航面板
3. **开始导航**：
   - 点击面板上的 ↑ ↓ 按钮
   - 或使用键盘快捷键：
     - **Mac**: `Option (⌥) + ↑/↓`
     - **Windows/Linux**: `Alt + ↑/↓`
4. **查看当前位置**：面板显示「当前回答 / 总回答数」

## ⚙️ 配置选项

1. 点击扩展图标旁的菜单 → 「选项」
2. 或右键点击扩展图标 → 「选项」
3. 在设置页面可以：
   - **主题设置**：选择界面主题（默认跟随系统）
     - 🌓 跟随系统：浅色模式→亮色主题，深色模式→暗色主题
     - 🟢 绿色、💜 薰衣草紫、⚫ 暗色、⚪ 亮色
   - **站点开关**：开启/关闭特定站点的导航功能
   - **快捷键说明**：查看所有可用快捷键

💡 **自定义快捷键**：访问 `chrome://extensions/shortcuts/` 可以修改快捷键

## 🛠️ 开发

### 项目结构

```
llm-answer-navigator/
├── src/
│   ├── background/          # Background Service Worker
│   │   └── index.ts
│   ├── content/             # Content Scripts
│   │   ├── index.ts
│   │   ├── siteAdapters/    # 站点适配器
│   │   │   ├── index.ts
│   │   │   └── chatgptAdapter.ts
│   │   └── navigation/      # 导航功能模块
│   │       ├── answerIndexManager.ts
│   │       ├── navigatorUI.ts
│   │       └── scrollAndHighlight.ts
│   ├── options/             # 设置页面
│   │   ├── index.html
│   │   └── index.ts
│   ├── popup/               # 弹出窗口
│   │   ├── index.html
│   │   └── index.ts
│   └── manifest.json        # 扩展清单
├── dist/                    # 构建输出目录
├── build.js                 # 构建脚本
├── package.json
├── tsconfig.json
├── README.md
└── ADAPTER_GUIDE.md         # 适配器开发指南
```

### 开发命令

```bash
# 安装依赖
npm install

# 开发构建（监听文件变化）
npm run dev

# 生产构建
npm run build
```

### 添加新站点支持

详细步骤请查看 [ADAPTER_GUIDE.md](./ADAPTER_GUIDE.md)

## 🏗️ 技术栈

- **语言**：TypeScript 5.3
- **打包工具**：esbuild
- **扩展规范**：Chrome Extension Manifest V3
- **API**：
  - Chrome Extension APIs (tabs, scripting, storage, commands)
  - DOM APIs
  - MutationObserver

## 📋 架构设计

### 模块职责

1. **Background Service Worker**
   - 监听快捷键命令
   - 转发消息到 Content Script

2. **Content Script**
   - 页面检测和适配器选择
   - 回答节点索引管理
   - 导航 UI 渲染和交互
   - 滚动和高亮效果

3. **站点适配器（Site Adapters）**
   - 识别特定站点
   - 提取 AI 回答节点
   - 可扩展架构，易于添加新站点

4. **导航模块**
   - `AnswerIndexManager`：管理回答节点和当前索引
   - `NavigatorUI`：浮动导航面板
   - `scrollAndHighlight`：滚动和高亮效果

## 🔧 已知限制和 TODO

### 当前限制
- 仅支持 ChatGPT 网站
- 快捷键在某些情况下可能与浏览器快捷键冲突

### 计划中的功能
- [ ] 支持更多 LLM 站点（Claude, Gemini, Copilot 等）
- [ ] 自定义快捷键
- [ ] 更多样式和主题选项
- [ ] 回答书签功能
- [ ] 导出对话功能

## 🤝 贡献

欢迎贡献！如果你想：
- 报告 bug
- 建议新功能
- 添加新站点支持
- 改进代码

请提交 Issue 或 Pull Request。

## 📄 许可证

MIT License

## 📮 反馈

如有问题或建议，欢迎通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件至 [your-email]

---

**Note**: 本项目是一个 PoC（概念验证）版本，持续改进中。


# 任务清单

## Task 1: 添加配置选项

### SubTask 1.1: 添加 i18n 翻译键
- [ ] 在 `src/utils/i18n.ts` 的 `zh-CN` 对象中添加：
  - `'options.nav.minScale': '最小节点缩放'`
  - `'options.nav.minScale.desc': '滚动模式下节点的最小尺寸'`
  - `'options.nav.scrollThreshold': '滚动阈值'`
  - `'options.nav.scrollThreshold.desc': '多少个节点后启用滚动'`
- [ ] 在 `src/utils/i18n.ts` 的 `en` 对象中添加对应的英文翻译

**代码位置**：i18n.ts:40 (zh-CN), i18n.ts:134 (en)

### SubTask 1.2: 添加 Options 页面 HTML
- [ ] 在 `src/options/index.html` 主题设置后添加导航配置区域
- [ ] 添加最小节点缩放滑块 (range input)
- [ ] 添加滚动阈值数字输入框

**代码位置**：options/index.html:188 (主题设置后)

### SubTask 1.3: 更新 Options 页面 TypeScript 逻辑
- [ ] 添加 `CONFIG_KEYS.NAV_MIN_SCALE` 和 `CONFIG_KEYS.NAV_SCROLL_THRESHOLD`
- [ ] 在 `loadSettings()` 中加载这两个配置
- [ ] 添加配置变更事件监听
- [ ] 使用 `chrome.tabs.sendMessage()` 通知内容脚本更新配置

**代码位置**：options/index.ts:4-17 (CONFIG_KEYS), 44-103 (loadSettings)

---

## Task 2: 实现动态高度与滚动逻辑

### SubTask 2.1: 重构 updateNodePositions()
- [ ] 将现有逻辑提取为 `applyFitMode()` 方法
- [ ] 添加模式判断逻辑（比较 requiredHeight 与 containerHeight）
- [ ] 调用对应的方法

**代码位置**：rightSideTimelineNavigator.ts:1113-1153

### SubTask 2.2: 实现 applyScrollMode()
- [ ] 计算动态内容高度
- [ ] 设置 `nodesContent.style.height`
- [ ] 按固定间距排列节点
- [ ] 调用 `updateSliderVisibility()`

**新增方法**：约 30 行代码

### SubTask 2.3: 实现 calculateScale()
- [ ] 根据节点数量和配置计算缩放比例
- [ ] 应用缩放变换到节点
- [ ] 确保缩放不影响 active 和 pinned 状态

**新增方法**：约 15 行代码

### SubTask 2.4: 更新 updateNodeStyle()
- [ ] 修改 `applyNormalNodeStyle`、`applyChristmasNodeStyle`、`applySciFiNodeStyle`
- [ ] 在应用 transform 时考虑缩放因子

**代码位置**：rightSideTimelineNavigator.ts:861-891, 762-789, 796-856

---

## Task 3: 实现配置同步

### SubTask 3.1: 添加配置属性
- [ ] 在类中添加 `config` 私有属性
- [ ] 初始化默认值

**代码位置**：rightSideTimelineNavigator.ts:95 (在现有常量后)

### SubTask 3.2: 实现 updateConfig() 方法
- [ ] 添加公共方法 `updateConfig(config: Partial<Config>)`
- [ ] 合并配置并调用 `updateNodePositions()`

**新增方法**：约 5 行代码

### SubTask 3.3: 监听配置变更消息
- [ ] 在 `content/index.ts` 中添加 chrome.storage 监听
- [ ] 或在 `content/index.ts` 中添加消息监听
- [ ] 调用 `navigator.updateConfig()`

**代码位置**：content/index.ts (需要确认)

---

## Task 4: 验证与测试

### SubTask 4.1: Fit Mode 验证（短对话）
- [ ] 创建或打开少于 15 个轮次的对话
- [ ] 验证节点均匀分布在整个高度
- [ ] 验证无滚动条显示

### SubTask 4.2: Scroll Mode 验证（长对话）
- [ ] 创建或打开超过 20 个轮次的对话
- [ ] 验证按固定间距排列
- [ ] 验证滚动条显示
- [ ] 验证所有节点可点击

### SubTask 4.3: 节点缩放验证
- [ ] 设置不同的最小缩放值
- [ ] 验证缩放生效
- [ ] 验证 active 和 pinned 状态正常显示

### SubTask 4.4: 配置实时生效
- [ ] 修改 Options 页面配置
- [ ] 验证无需刷新页面即可生效
- [ ] 验证配置持久化

### SubTask 4.5: 键盘导航验证
- [ ] 使用 Alt+W/S 导航
- [ ] 验证活动节点自动滚动到可见区域
- [ ] 验证滚动条同步更新

---

# 任务依赖关系

```
Task 1 (配置选项)
├── SubTask 1.1 (i18n) ──────────┐
├── SubTask 1.2 (HTML) ───────────┼─→ Task 4 (测试)
└── SubTask 1.3 (TS) ────────────┘
                                      │
Task 2 (核心逻辑) ───────────────────┘
├── SubTask 2.1 (重构)
├── SubTask 2.2 (Scroll Mode)
├── SubTask 2.3 (缩放)
└── SubTask 2.4 (样式更新) ──┐
                              │
Task 3 (配置同步) ────────────┘
├── SubTask 3.1 (属性)
├── SubTask 3.2 (方法)
└── SubTask 3.3 (消息)
```

**关键路径**：Task 1.1 → Task 2 → Task 3 → Task 4

**可并行**：Task 1.2、1.3 可与 Task 2 同时开发（需要定义好接口）

---

# 预估工作量

| 任务 | 复杂度 | 代码量 | 说明 |
|------|--------|--------|------|
| SubTask 1.1 | 低 | ~8 行 | 翻译键 |
| SubTask 1.2 | 低 | ~25 行 | HTML |
| SubTask 1.3 | 中 | ~40 行 | TypeScript |
| SubTask 2.1 | 中 | ~40 行 | 重构 |
| SubTask 2.2 | 中 | ~30 行 | 新方法 |
| SubTask 2.3 | 低 | ~15 行 | 新方法 |
| SubTask 2.4 | 中 | ~20 行 | 修改现有方法 |
| SubTask 3.1 | 低 | ~5 行 | 属性定义 |
| SubTask 3.2 | 低 | ~5 行 | 新方法 |
| SubTask 3.3 | 中 | ~15 行 | 消息处理 |
| Task 4 | 中 | - | 测试 |

**总计**：约 200 行新增/修改代码

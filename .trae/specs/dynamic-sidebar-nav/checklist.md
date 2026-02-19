# 完成检查清单

## 代码变更

### 配置系统
- [ ] `src/utils/i18n.ts` 添加了 4 个翻译键（中英文）
- [ ] `src/options/index.html` 添加了导航配置区域
- [ ] `src/options/index.ts` 添加了配置加载和保存逻辑
- [ ] `chrome.storage` 存储 `nav_node_min_scale` 和 `nav_scroll_threshold`

### 核心逻辑
- [ ] `rightSideTimelineNavigator.ts` 添加了 `config` 属性
- [ ] `updateNodePositions()` 支持模式判断
- [ ] 新增 `applyFitMode()` 方法
- [ ] 新增 `applyScrollMode()` 方法
- [ ] 新增 `calculateScale()` 方法
- [ ] `updateConfig()` 方法实现
- [ ] `updateNodeStyle()` 支持缩放因子

### 消息通信
- [ ] Options 页面配置变更能通知内容脚本
- [ ] 内容脚本能接收并应用配置

---

## 构建验证

- [ ] `npm run build` 执行成功
- [ ] 无 TypeScript 编译错误
- [ ] 无控制台警告

---

## 功能验证

### Fit Mode（适配模式）
- [ ] 短对话（<15 轮）节点均匀分布
- [ ] 无滚动条显示
- [ ] 节点大小正常（100%）

### Scroll Mode（滚动模式）
- [ ] 长对话（>18 轮）自动启用滚动
- [ ] 节点按固定间距排列
- [ ] 滚动条正确显示
- [ ] 所有节点可点击
- [ ] 滚动条拖动正常

### 节点缩放
- [ ] 长对话节点自动缩小
- [ ] 最小缩放不小于配置值
- [ ] Active 节点突出显示
- [ ] Pinned 节点正确显示
- [ ] Hover 效果正常

### 配置功能
- [ ] Options 页面显示导航配置
- [ ] 最小节点缩放滑块可调节
- [ ] 滚动阈值输入框可用
- [ ] 配置修改后保存到 storage
- [ ] 配置修改后立即生效（无需刷新）

### 键盘导航
- [ ] Alt+W/S 切换节点
- [ ] 活动节点自动滚动到可见区域
- [ ] 滚动条位置同步更新

### 滚动同步
- [ ] 主页面滚动触发活动节点更新
- [ ] 侧边栏自动滚动到活动节点
- [ ] Tooltip 在滚动时正确定位

---

## 边界情况

- [ ] 0 个节点：不显示，无错误
- [ ] 1 个节点：显示在顶部
- [ ] 2 个节点：正确分布
- [ ] 极长对话（100+ 轮）：性能正常
- [ ] 配置极值（minScale=0.3, threshold=30）：正常工作

---

## 代码质量

- [ ] 代码风格与现有代码一致
- [ ] 注释清晰
- [ ] 无 console.error 残留
- [ ] TypeScript 类型正确

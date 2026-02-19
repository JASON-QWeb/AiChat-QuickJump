# 动态侧边栏导航 - 规格说明

## 背景与目标

### 当前问题
当对话轮次超过约 18 个时，节点被挤压在固定高度的容器（80vh, max 800px）内，导致：
- 节点间距过小，难以区分
- 第 19 个及后续节点可能被遮挡或不可点击
- 用户体验下降

### 解决方案
实现两种显示模式的自动切换：
- **Fit Mode（适配模式）**：节点均匀分布在整个容器高度（当前行为）
- **Scroll Mode（滚动模式）**：节点按固定间距排列，内容超出容器时显示滚动条

---

## 现状分析

### 当前架构

```
container (80vh, max 800px, fixed)
├── timelineBar (100% height, visual line)
├── nodesWrapper (overflowY: auto, scrollable)
│   └── nodesContent (height: 100%, currently fixed)
│       └── nodes[] (positioned by % distribution)
└── slider (custom scrollbar, optional)
```

### 关键代码位置

| 功能 | 文件 | 行号 |
|------|------|------|
| 容器创建 | rightSideTimelineNavigator.ts | 520-542 |
| 滚动容器 | rightSideTimelineNavigator.ts | 569-593 |
| 内容容器 | rightSideTimelineNavigator.ts | 595-605 |
| 节点定位 | rightSideTimelineNavigator.ts | 1113-1153 |
| 滚动条 | rightSideTimelineNavigator.ts | 1306-1446 |
| 可见性确保 | rightSideTimelineNavigator.ts | 1165-1188 |

### 现有配置

| 常量 | 值 | 说明 |
|------|-----|------|
| `NODE_PADDING` | 30 | 上下留白 |
| `MIN_NODE_GAP` | 28 | 最小节点间距（当前未使用） |

---

## 需求规格

### 需求 1：模式切换机制
**系统应**根据节点数量和最小间距自动选择显示模式。

#### 切换条件
```typescript
// 伪代码
const requiredHeight = NODE_PADDING * 2 + (nodeCount - 1) * MIN_NODE_GAP;
const containerHeight = container.clientHeight;

if (requiredHeight > containerHeight) {
  // 启用 Scroll Mode
  useScrollMode();
} else {
  // 使用 Fit Mode（现有逻辑）
  useFitMode();
}
```

#### 模式特性
| 特性 | Fit Mode | Scroll Mode |
|------|----------|-------------|
| 节点间距 | 均匀分布 | 固定 `MIN_NODE_GAP` |
| 内容高度 | 100% | 动态计算 |
| 滚动条 | 隐藏 | 显示 |
| 节点缩放 | 无 | 可选 |

### 需求 2：节点缩放（可选）
**系统应**在 Scroll Mode 下根据配置缩放节点大小。

#### 缩放公式
```typescript
function calculateScale(nodeCount: number, minScale: number): number {
  const SCALE_THRESHOLD = 15; // 超过此数量开始缩放
  const MAX_SCALE_REDUCTION = 0.4; // 最大缩放到 60%

  if (nodeCount <= SCALE_THRESHOLD) return 1.0;

  const excessNodes = nodeCount - SCALE_THRESHOLD;
  const reduction = Math.min(MAX_SCALE_REDUCTION, excessNodes * 0.02);
  return Math.max(minScale, 1.0 - reduction);
}
```

### 需求 3：配置选项
**系统应**在 Options 页面提供以下配置：

| 配置项 | 键名 | 类型 | 默认值 | 范围 |
|--------|------|------|--------|------|
| 最小节点缩放 | `nav_node_min_scale` | number | 0.6 | 0.3 - 1.0 |
| 启用滚动模式阈值 | `nav_scroll_threshold` | number | 18 | 10 - 30 |

### 需求 4：滚动同步
**系统应**确保以下场景下活动节点可见：
- 键盘导航（Alt+W/S）
- 主页面滚动触发节点更新
- 用户点击节点

---

## 技术方案

### 方案 1：修改 updateNodePositions()

**文件**：`rightSideTimelineNavigator.ts:1113-1153`

```typescript
private updateNodePositions(): void {
  if (this.isUpdatingPositions) return;
  this.isUpdatingPositions = true;

  try {
    const count = this.items.length;
    if (count === 0) return;

    const containerHeight = this.container.clientHeight;
    if (containerHeight === 0) return;

    const padding = this.NODE_PADDING;
    const minGap = this.MIN_NODE_GAP;

    // 计算所需高度
    const requiredHeight = padding * 2 + (count - 1) * minGap;

    // 决定使用哪种模式
    if (requiredHeight > containerHeight) {
      // Scroll Mode
      this.applyScrollMode(count, padding, minGap);
    } else {
      // Fit Mode (现有逻辑)
      this.applyFitMode(count, padding, containerHeight);
    }
  } finally {
    this.isUpdatingPositions = false;
  }
}

private applyScrollMode(count: number, padding: number, minGap: number): void {
  // 设置内容高度
  const contentHeight = padding * 2 + (count - 1) * minGap;
  this.nodesContent.style.height = `${contentHeight}px`;
  this.contentHeight = contentHeight;

  // 按固定间距排列节点
  this.items.forEach((item, index) => {
    const node = this.nodes[index];
    if (!node) return;

    const topPosition = padding + index * minGap;
    node.style.top = `${topPosition}px`;

    // 应用缩放（如果启用）
    const scale = this.calculateScale(count);
    if (scale !== 1.0) {
      const currentTransform = node.style.transform;
      // 保留 transform 中的其他部分（如 active 状态的 scale）
      node.style.transform = currentTransform.replace(/scale\([^)]+\)/, `scale(${scale})`);
    }
  });

  // 显示滚动条
  this.updateSliderVisibility();
}

private applyFitMode(count: number, padding: number, containerHeight: number): void {
  // 恢复内容高度为 100%
  this.nodesContent.style.height = '100%';
  this.contentHeight = containerHeight;

  const usableHeight = containerHeight - padding * 2;

  this.items.forEach((item, index) => {
    const node = this.nodes[index];
    if (!node) return;

    let topPosition = padding;
    if (count > 1) {
      const ratio = index / (count - 1);
      topPosition = padding + ratio * usableHeight;
    }

    node.style.top = `${topPosition}px`;
  });

  // 隐藏滚动条
  this.hideSlider();
}

private calculateScale(nodeCount: number): number {
  const minScale = this.config.minNodeScale ?? 0.6;
  const threshold = this.config.scrollThreshold ?? 18;

  if (nodeCount <= threshold) return 1.0;

  const excess = nodeCount - threshold;
  const reduction = Math.min(0.4, excess * 0.02);
  return Math.max(minScale, 1.0 - reduction);
}
```

### 方案 2：添加配置管理

**新增私有属性**：
```typescript
private config: {
  minNodeScale: number;
  scrollThreshold: number;
} = {
  minNodeScale: 0.6,
  scrollThreshold: 18
};
```

**新增方法**：
```typescript
/**
 * 更新配置（从 Options 页面调用）
 */
updateConfig(config: Partial<typeof this.config>): void {
  this.config = { ...this.config, ...config };
  this.updateNodePositions();
}
```

### 方案 3：Options 页面配置

**文件**：`options/index.html`（在主题设置后添加）

```html
<div class="option-item">
  <div class="option-label">
    <span class="title" data-i18n="options.nav.minScale">最小节点缩放</span>
    <span class="description" data-i18n="options.nav.minScale.desc">滚动模式下节点的最小尺寸</span>
  </div>
  <input type="range" id="nav-min-scale" min="0.3" max="1.0" step="0.1" value="0.6"
         style="width: 100px; cursor: pointer;">
  <span id="nav-min-scale-value" style="margin-left: 10px; min-width: 40px;">0.6</span>
</div>

<div class="option-item">
  <div class="option-label">
    <span class="title" data-i18n="options.nav.scrollThreshold">滚动阈值</span>
    <span class="description" data-i18n="options.nav.scrollThreshold.desc">多少个节点后启用滚动</span>
  </div>
  <input type="number" id="nav-scroll-threshold" min="10" max="30" value="18"
         style="width: 60px; padding: 4px; border-radius: 4px; border: 1px solid #ddd;">
</div>
```

### 方案 4：i18n 翻译

**文件**：`src/utils/i18n.ts`

```typescript
// zh-CN
'options.nav.minScale': '最小节点缩放',
'options.nav.minScale.desc': '滚动模式下节点的最小尺寸',
'options.nav.scrollThreshold': '滚动阈值',
'options.nav.scrollThreshold.desc': '多少个节点后启用滚动',

// en
'options.nav.minScale': 'Min Node Scale',
'options.nav.minScale.desc': 'Minimum node size in scroll mode',
'options.nav.scrollThreshold': 'Scroll Threshold',
'options.nav.scrollThreshold.desc': 'Number of nodes before enabling scroll',
```

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 模式切换时位置跳动 | 中 | 使用平滑过渡动画 |
| 节点过小难以点击 | 低 | 设置 minScale 下限（0.3） |
| 滚动条与现有逻辑冲突 | 低 | 复用现有 slider 实现 |
| 配置值不合理 | 低 | Options 页面限制输入范围 |

---

## 影响范围

| 文件 | 变更类型 | 变更量 |
|------|----------|--------|
| `rightSideTimelineNavigator.ts` | 修改 | ~100 行新增/修改 |
| `options/index.html` | 新增 | ~20 行 |
| `options/index.ts` | 新增 | ~50 行 |
| `src/utils/i18n.ts` | 新增 | 4 个翻译键 |

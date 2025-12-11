/**
 * 主题配置
 */

export interface TimelineTheme {
  name: string;
  activeColor: string;      // 激活节点的背景色
  activeShadow: string;     // 激活节点的阴影颜色
  defaultNodeColor: string; // 默认（未激活）节点的背景色
  timelineBarColor: string; // 时间线主干颜色
  pinnedColor: string;      // 重点标记颜色（取代默认的橙色）
  tooltipBackgroundColor: string; // Tooltip 背景色
  tooltipTextColor: string;       // Tooltip 文字颜色
  highlightBorder: string;        // 高亮边框颜色
  highlightBackground: string;    // 高亮背景颜色
  // 特殊主题类型标识
  themeType?: 'christmas' | 'scifi' | 'normal';
}

export const themes: Record<string, TimelineTheme> = {
  light: {
    name: '亮色',
    activeColor: '#29B6F6', // 浅蓝
    activeShadow: 'rgba(41, 182, 246, 0.5)',
    defaultNodeColor: '#dbdbdb', // 浅灰色
    timelineBarColor: 'rgba(150, 150, 150, 0.3)',
    pinnedColor: '#0277BD', // 深蓝
    tooltipBackgroundColor: 'rgba(255, 255, 255, 0.95)',
    tooltipTextColor: '#000000', // 黑色
    highlightBorder: '#29B6F6',
    highlightBackground: 'rgba(41, 182, 246, 0.1)'
  },
  dark: {
    name: '暗色',
    activeColor: '#E0E0E0', // 亮灰 (选中)
    activeShadow: 'rgba(255, 255, 255, 0.3)',
    defaultNodeColor: '#FFFFFF', // 白色 (默认)
    timelineBarColor: 'rgba(255, 255, 255, 0.2)',
    pinnedColor: '#FF9800', // 橙色 (暗色下依然醒目)
    tooltipBackgroundColor: 'rgba(50, 50, 50, 0.95)',
    tooltipTextColor: '#FFFFFF',
    highlightBorder: '#E0E0E0',
    highlightBackground: 'rgba(255, 255, 255, 0.1)'
  },
  blue: {
    name: '天蓝色',
    activeColor: '#2196F3', // 鲜亮蓝
    activeShadow: 'rgba(33, 150, 243, 0.5)',
    defaultNodeColor: '#90CAF9', // 浅蓝
    timelineBarColor: 'rgba(33, 150, 243, 0.3)',
    pinnedColor: '#0D47A1', // 深蓝 (重点)
    tooltipBackgroundColor: 'rgba(227, 242, 253, 0.95)', // 极浅蓝
    tooltipTextColor: '#0D47A1', // 深蓝
    highlightBorder: '#2196F3',
    highlightBackground: 'rgba(33, 150, 243, 0.1)'
  },
  lavender: {
    name: '薰衣草',
    activeColor: '#9C88FF', // 紫色
    activeShadow: 'rgba(156, 136, 255, 0.5)',
    defaultNodeColor: '#D1C4E9', // 浅紫
    timelineBarColor: 'rgba(156, 136, 255, 0.3)',
    pinnedColor: '#673AB7', // 深紫 (重点)
    tooltipBackgroundColor: 'rgba(237, 231, 246, 0.95)', // 极浅紫
    tooltipTextColor: '#4527A0', // 深紫
    highlightBorder: '#9C88FF',
    highlightBackground: 'rgba(156, 136, 255, 0.1)'
  },
  pink: {
    name: '粉红色',
    activeColor: '#FF4081', // 亮粉
    activeShadow: 'rgba(255, 64, 129, 0.5)',
    defaultNodeColor: '#F8BBD0', // 浅粉
    timelineBarColor: 'rgba(255, 64, 129, 0.3)',
    pinnedColor: '#C2185B', // 深粉红 (重点)
    tooltipBackgroundColor: 'rgba(252, 228, 236, 0.95)', // 极浅粉
    tooltipTextColor: '#880E4F', // 深粉
    highlightBorder: '#FF4081',
    highlightBackground: 'rgba(255, 64, 129, 0.1)'
  },
  orange: {
    name: '橘黄色',
    activeColor: '#FF9800', // 橘黄
    activeShadow: 'rgba(255, 152, 0, 0.5)',
    defaultNodeColor: '#FFE0B2', // 浅橘
    timelineBarColor: 'rgba(255, 152, 0, 0.3)',
    pinnedColor: '#E65100', // 深橘红 (重点)
    tooltipBackgroundColor: 'rgba(255, 243, 224, 0.95)', // 极浅橘
    tooltipTextColor: '#E65100', // 深橘
    highlightBorder: '#FF9800',
    highlightBackground: 'rgba(255, 152, 0, 0.1)',
    themeType: 'normal'
  },
  christmas: {
    name: '圣诞',
    activeColor: '#FFD700', // 金黄色 (激活节点常亮)
    activeShadow: 'rgba(255, 215, 0, 0.8)',
    defaultNodeColor: '#B8860B', // 暗黄色 (默认节点呼吸灯)
    timelineBarColor: 'linear-gradient(180deg, #FF0000, #00FF00, #FF0000, #00FF00)', // 红绿灯条
    pinnedColor: '#FFD700', // 金色 (标记节点更亮更大)
    tooltipBackgroundColor: 'rgba(255, 253, 245, 0.98)', // 温暖蛋黄白
    tooltipTextColor: '#8B4513', // 深褐色
    highlightBorder: '#FFD700',
    highlightBackground: 'rgba(255, 215, 0, 0.15)',
    themeType: 'christmas'
  },
  scifi: {
    name: '未来',
    activeColor: '#00A8FF', // 科技蓝 (激活节点)
    activeShadow: 'rgba(0, 168, 255, 0.6)',
    defaultNodeColor: '#0088CC', // 深科技蓝 (默认节点)
    timelineBarColor: 'rgba(180, 150, 220, 0.5)', // 淡紫色梦幻
    pinnedColor: '#FF4444', // 红色 (标注节点)
    tooltipBackgroundColor: 'rgba(40, 35, 60, 0.92)', // 淡紫灰，适配主题
    tooltipTextColor: '#B8D4FF', // 淡蓝色文字
    highlightBorder: '#00A8FF',
    highlightBackground: 'rgba(0, 168, 255, 0.1)',
    themeType: 'scifi'
  }
};

export type ThemeType = keyof typeof themes;
export type ThemeMode = ThemeType | 'auto';

/**
 * 根据系统主题获取对应的主题
 */
export function getSystemTheme(): ThemeType {
  // 检测系统是否使用暗色模式
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/**
 * 根据模式解析实际主题
 */
export function resolveTheme(mode: ThemeMode): ThemeType {
  if (mode === 'auto') {
    return getSystemTheme();
  }
  // 如果是不存在的 mode，回退到 light
  if (!themes[mode]) {
    return 'light';
  }
  return mode as ThemeType;
}

export const DEFAULT_THEME_MODE: ThemeMode = 'auto';

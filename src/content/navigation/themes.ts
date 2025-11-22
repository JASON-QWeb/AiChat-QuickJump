/**
 * 主题配置
 */

export interface Theme {
  name: string;
  primary: string;
  primaryHover: string;
  primaryActive: string;
  border: string;
  background: string;
  textColor: string;
  highlightBorder: string;
  highlightBackground: string;
}

export const themes: Record<string, Theme> = {
  green: {
    name: '绿色',
    primary: '#4CAF50',
    primaryHover: '#45a049',
    primaryActive: '#3d8b40',
    border: '#4CAF50',
    background: 'rgba(255, 255, 255, 0.95)',
    textColor: '#333',
    highlightBorder: '#4CAF50',
    highlightBackground: 'rgba(76, 175, 80, 0.1)',
  },
  lavender: {
    name: '薰衣草紫',
    primary: '#9C88FF',
    primaryHover: '#8B76EE',
    primaryActive: '#7A65DD',
    border: '#9C88FF',
    background: 'rgba(255, 255, 255, 0.95)',
    textColor: '#333',
    highlightBorder: '#9C88FF',
    highlightBackground: 'rgba(156, 136, 255, 0.1)',
  },
  dark: {
    name: '暗色',
    primary: '#6B7280',
    primaryHover: '#4B5563',
    primaryActive: '#374151',
    border: '#4B5563',
    background: 'rgba(30, 30, 30, 0.95)',
    textColor: '#E5E7EB',
    highlightBorder: '#6B7280',
    highlightBackground: 'rgba(107, 114, 128, 0.15)',
  },
  light: {
    name: '亮色',
    primary: '#3B82F6',
    primaryHover: '#2563EB',
    primaryActive: '#1D4ED8',
    border: '#3B82F6',
    background: 'rgba(255, 255, 255, 0.98)',
    textColor: '#1F2937',
    highlightBorder: '#3B82F6',
    highlightBackground: 'rgba(59, 130, 246, 0.1)',
  },
};

export type ThemeType = keyof typeof themes;
export type ThemeMode = ThemeType | 'auto'; // auto 表示跟随系统

/**
 * 根据系统主题获取对应的主题
 */
export function getSystemTheme(): ThemeType {
  // 检测系统是否使用暗色模式
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  // 浅色模式使用亮色主题（白黑搭配）
  return 'light';
}

/**
 * 根据主题模式获取实际应用的主题
 */
export function resolveTheme(mode: ThemeMode): ThemeType {
  if (mode === 'auto') {
    return getSystemTheme();
  }
  return mode as ThemeType;
}

export const DEFAULT_THEME_MODE: ThemeMode = 'auto'; // 默认跟随系统


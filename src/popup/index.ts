// Popup script
import { getTranslation, type Language } from '../utils/i18n';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. 设置快捷键链接点击事件
  const shortcutsLink = document.getElementById('shortcuts-link');
  if (shortcutsLink) {
    shortcutsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  }

  // 2. 检测系统/Mac 还是 Win，显示对应快捷键提示（简单 CSS 处理可能不够，这里做个类名切换）
  const platform = navigator.platform.toLowerCase();
  const isMac = platform.includes('mac');
  const body = document.body;
  
  if (isMac) {
    body.classList.add('is-mac');
    // 这里其实可以更精细地控制显示，但目前的 CSS 是同时显示的，只是布局上区分
    // 如果需要只显示对应平台的，可以在 CSS 里用 .is-mac .platform-switch:not(.mac) { display: none; }
  } else {
    body.classList.add('is-win');
  }

  // 3. 加载语言设置并翻译
  try {
    const { language } = await chrome.storage.sync.get(['language']);
    const currentLang = (language || 'auto') as Language;
    
    applyTranslations(currentLang);
  } catch (e) {
    // console.error('Failed to load language settings:', e);
    // 默认为 auto -> en/zh
    applyTranslations('auto');
  }
});

function applyTranslations(lang: Language) {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = getTranslation(key, lang);
    }
  });
}

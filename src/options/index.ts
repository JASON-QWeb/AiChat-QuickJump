// Options page script
import { getTranslation, type Language } from '../utils/i18n';

// 配置键
const CONFIG_KEYS = {
  ENABLE_CHATGPT: 'enable_chatgpt',
  ENABLE_CLAUDE: 'enable_claude',
  ENABLE_GEMINI: 'enable_gemini',
  ENABLE_DEEPSEEK: 'enable_deepseek',
  ENABLE_GROK: 'enable_grok',
  ENABLE_KIMI: 'enable_kimi',
  ENABLE_QWEN: 'enable_qwen',
  ENABLE_DOUBAO: 'enable_doubao',
  UI_THEME: 'ui_theme',
  CUSTOM_URLS: 'custom_urls',
  LANGUAGE: 'language'
};

let currentLanguage: Language = 'auto';

// 应用翻译
function applyTranslations(lang: Language) {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = getTranslation(key, lang);
    }
  });

  const inputs = document.querySelectorAll('[data-i18n-placeholder]');
  inputs.forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      (el as HTMLInputElement).placeholder = getTranslation(key, lang);
    }
  });
  
  // 更新页面标题
  document.title = getTranslation('options.title', lang);
}

// 加载配置
async function loadSettings(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get([
      CONFIG_KEYS.ENABLE_CHATGPT,
      CONFIG_KEYS.ENABLE_CLAUDE,
      CONFIG_KEYS.ENABLE_GEMINI,
      CONFIG_KEYS.ENABLE_DEEPSEEK,
      CONFIG_KEYS.ENABLE_GROK,
      CONFIG_KEYS.ENABLE_KIMI,
      CONFIG_KEYS.ENABLE_QWEN,
      CONFIG_KEYS.ENABLE_DOUBAO,
      CONFIG_KEYS.UI_THEME,
      CONFIG_KEYS.CUSTOM_URLS,
      CONFIG_KEYS.LANGUAGE
    ]);
    
    const enableChatGPT = result[CONFIG_KEYS.ENABLE_CHATGPT] !== false; // 默认启用
    const enableClaude = result[CONFIG_KEYS.ENABLE_CLAUDE] !== false; // 默认启用
    const enableGemini = result[CONFIG_KEYS.ENABLE_GEMINI] !== false; // 默认启用
    const enableDeepSeek = result[CONFIG_KEYS.ENABLE_DEEPSEEK] !== false; // 默认启用
    const enableGrok = result[CONFIG_KEYS.ENABLE_GROK] !== false; // 默认启用
    const enableKimi = result[CONFIG_KEYS.ENABLE_KIMI] !== false; // 默认启用
    const enableQwen = result[CONFIG_KEYS.ENABLE_QWEN] !== false; // 默认启用
    const enableDoubao = result[CONFIG_KEYS.ENABLE_DOUBAO] !== false; // 默认启用
    const uiTheme = result[CONFIG_KEYS.UI_THEME] || 'auto'; // 默认跟随系统
    const customUrls = result[CONFIG_KEYS.CUSTOM_URLS] || [];
    const language = result[CONFIG_KEYS.LANGUAGE] || 'auto';
    
    currentLanguage = language;
    applyTranslations(currentLanguage);

    const setCheckbox = (id: string, checked: boolean) => {
        const checkbox = document.getElementById(id) as HTMLInputElement;
        if (checkbox) checkbox.checked = checked;
    };

    setCheckbox('enable-chatgpt', enableChatGPT);
    setCheckbox('enable-claude', enableClaude);
    setCheckbox('enable-gemini', enableGemini);
    setCheckbox('enable-deepseek', enableDeepSeek);
    setCheckbox('enable-grok', enableGrok);
    setCheckbox('enable-kimi', enableKimi);
    setCheckbox('enable-qwen', enableQwen);
    setCheckbox('enable-doubao', enableDoubao);
    
    const themeSelect = document.getElementById('ui-theme') as HTMLSelectElement;
    if (themeSelect) {
      themeSelect.value = uiTheme;
    }
    
    const langSelect = document.getElementById('language-select') as HTMLSelectElement;
    if (langSelect) {
      langSelect.value = language;
    }
    
    renderCustomUrls(customUrls);
  } catch (error) {
    // console.error('加载设置失败:', error);
  }
}

// 渲染自定义 URL 列表
function renderCustomUrls(urls: string[]): void {
  const list = document.getElementById('custom-url-list');
  if (!list) return;
  
  list.innerHTML = '';
  
  urls.forEach((url, index) => {
    const li = document.createElement('li');
    Object.assign(li.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 12px',
      borderBottom: '1px solid #eee',
      background: '#f9f9f9',
      borderRadius: '4px',
      marginBottom: '5px'
    });
    
    const span = document.createElement('span');
    span.textContent = url;
    span.style.color = '#333';
    
    const btn = document.createElement('button');
    btn.textContent = getTranslation('options.sites.custom.delete', currentLanguage);
    Object.assign(btn.style, {
      padding: '4px 8px',
      background: '#ff4444',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px'
    });
    
    btn.onclick = () => {
      const newUrls = urls.filter((_, i) => i !== index);
      saveSetting(CONFIG_KEYS.CUSTOM_URLS, newUrls);
      renderCustomUrls(newUrls);
    };
    
    li.appendChild(span);
    li.appendChild(btn);
    list.appendChild(li);
  });
}

// 添加自定义 URL
function addCustomUrl(): void {
  const input = document.getElementById('custom-url-input') as HTMLInputElement;
  const url = input.value.trim();
  
  if (!url) return;
  
  // 简单的域名验证
  let domain = url;
  try {
    if (!url.startsWith('http')) {
      // 如果不带协议，尝试解析
      // 简单处理：如果不含 /，假设是域名
      if (url.includes('/')) {
         domain = new URL('https://' + url).hostname;
      } else {
         domain = url;
      }
    } else {
      domain = new URL(url).hostname;
    }
  } catch (e) {
    alert(getTranslation('options.domain.invalid', currentLanguage));
    return;
  }
  
  chrome.storage.sync.get([CONFIG_KEYS.CUSTOM_URLS], (result) => {
    const urls = result[CONFIG_KEYS.CUSTOM_URLS] || [];
    if (!urls.includes(domain)) {
      const newUrls = [...urls, domain];
      saveSetting(CONFIG_KEYS.CUSTOM_URLS, newUrls);
      renderCustomUrls(newUrls);
      input.value = '';
    } else {
      alert(getTranslation('options.domain.exists', currentLanguage));
    }
  });
}

// 保存配置
async function saveSetting(key: string, value: any): Promise<void> {
  try {
    await chrome.storage.sync.set({ [key]: value });
    showSaveStatus();
  } catch (error) {
    // console.error('保存设置失败:', error);
  }
}

// 显示保存状态提示
function showSaveStatus(): void {
  const status = document.getElementById('save-status');
  if (status) {
    status.classList.add('success');
    status.style.display = 'block';
    
    setTimeout(() => {
      status.style.display = 'none';
    }, 2000);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 加载设置
  loadSettings();
  
  // 监听开关变化
  const bindCheckbox = (id: string, key: string) => {
    const checkbox = document.getElementById(id) as HTMLInputElement;
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        saveSetting(key, target.checked);
      });
    }
  };

  bindCheckbox('enable-chatgpt', CONFIG_KEYS.ENABLE_CHATGPT);
  bindCheckbox('enable-claude', CONFIG_KEYS.ENABLE_CLAUDE);
  bindCheckbox('enable-gemini', CONFIG_KEYS.ENABLE_GEMINI);
  bindCheckbox('enable-deepseek', CONFIG_KEYS.ENABLE_DEEPSEEK);
  bindCheckbox('enable-grok', CONFIG_KEYS.ENABLE_GROK);
  bindCheckbox('enable-kimi', CONFIG_KEYS.ENABLE_KIMI);
  bindCheckbox('enable-qwen', CONFIG_KEYS.ENABLE_QWEN);
  bindCheckbox('enable-doubao', CONFIG_KEYS.ENABLE_DOUBAO);
  
  // 监听主题选择变化
  const themeSelect = document.getElementById('ui-theme') as HTMLSelectElement;
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      saveSetting(CONFIG_KEYS.UI_THEME, target.value);
      
      // 通知所有标签页更新主题
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'LLM_NAV_UPDATE_THEME',
              theme: target.value
            }).catch(() => {
              // 忽略错误（某些标签页可能没有 content script）
            });
          }
        });
      });
    });
  }

  // 监听语言选择变化
  const langSelect = document.getElementById('language-select') as HTMLSelectElement;
  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const newLang = target.value as Language;
      saveSetting(CONFIG_KEYS.LANGUAGE, newLang);
      currentLanguage = newLang;
      applyTranslations(newLang);
      // 重新渲染 URL 列表以更新删除按钮文本
      chrome.storage.sync.get([CONFIG_KEYS.CUSTOM_URLS], (result) => {
        const urls = result[CONFIG_KEYS.CUSTOM_URLS] || [];
        renderCustomUrls(urls);
      });
    });
  }
  
  // 自定义 URL 添加按钮
  const addBtn = document.getElementById('add-url-btn');
  if (addBtn) {
    addBtn.addEventListener('click', addCustomUrl);
  }
  
  // 监听回车键添加
  const urlInput = document.getElementById('custom-url-input');
  if (urlInput) {
    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addCustomUrl();
      }
    });
  }
});

// Options page script
console.log('Options page loaded');

// 配置键
const CONFIG_KEYS = {
  ENABLE_CHATGPT: 'enable_chatgpt',
  UI_THEME: 'ui_theme',
  CUSTOM_URLS: 'custom_urls'
};

// 加载配置
async function loadSettings(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get([
      CONFIG_KEYS.ENABLE_CHATGPT,
      CONFIG_KEYS.UI_THEME,
      CONFIG_KEYS.CUSTOM_URLS
    ]);
    
    const enableChatGPT = result[CONFIG_KEYS.ENABLE_CHATGPT] !== false; // 默认启用
    const uiTheme = result[CONFIG_KEYS.UI_THEME] || 'auto'; // 默认跟随系统
    const customUrls = result[CONFIG_KEYS.CUSTOM_URLS] || [];
    
    const checkbox = document.getElementById('enable-chatgpt') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = enableChatGPT;
    }
    
    const themeSelect = document.getElementById('ui-theme') as HTMLSelectElement;
    if (themeSelect) {
      themeSelect.value = uiTheme;
    }
    
    renderCustomUrls(customUrls);
    
    console.log('设置已加载:', { enableChatGPT, uiTheme, customUrls });
  } catch (error) {
    console.error('加载设置失败:', error);
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
    btn.textContent = '删除';
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
    alert('请输入有效的域名');
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
      alert('该域名已存在');
    }
  });
}

// 保存配置
async function saveSetting(key: string, value: any): Promise<void> {
  try {
    await chrome.storage.sync.set({ [key]: value });
    showSaveStatus();
    console.log('设置已保存:', { [key]: value });
  } catch (error) {
    console.error('保存设置失败:', error);
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
  
  // 监听 ChatGPT 开关变化
  const chatgptCheckbox = document.getElementById('enable-chatgpt') as HTMLInputElement;
  if (chatgptCheckbox) {
    chatgptCheckbox.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      saveSetting(CONFIG_KEYS.ENABLE_CHATGPT, target.checked);
    });
  }
  
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


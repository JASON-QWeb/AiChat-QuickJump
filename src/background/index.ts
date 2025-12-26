// Background Service Worker

const CUSTOM_SCRIPT_ID = 'llm-nav-custom-sites';

/**
 * 更新自定义站点的 Content Scripts
 */
async function updateContentScripts(customUrls: string[]) {
  try {
    // 1. 获取现有的脚本
    const scripts = await chrome.scripting.getRegisteredContentScripts();
    const scriptIds = scripts.map(s => s.id);
    
    // 2. 如果存在旧的注册，先移除
    if (scriptIds.includes(CUSTOM_SCRIPT_ID)) {
      await chrome.scripting.unregisterContentScripts({ ids: [CUSTOM_SCRIPT_ID] });
    }

    if (!customUrls || customUrls.length === 0) return;

    // 3. 构建匹配规则
    const matches = customUrls.map(url => {
        // 移除可能存在的协议前缀，统一处理
        let domain = url.replace(/^https?:\/\//, '');
        // 移除末尾斜杠
        domain = domain.replace(/\/$/, '');
        
        // 生成 http 和 https 两种匹配
        // 注意：Manifest 中必须有相应的 host_permissions 才能生效
        return [`http://${domain}/*`, `https://${domain}/*`];
    }).flat();

    // 4. 注册新脚本
    await chrome.scripting.registerContentScripts([{
      id: CUSTOM_SCRIPT_ID,
      js: ['content/index.js'],
      matches: matches,
      runAt: 'document_idle'
    }]);
    
    // console.log('Custom site scripts registered for:', matches);
  } catch (err) {
    // console.error('Failed to update content scripts:', err);
  }
}

// 监听配置变化
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.custom_urls) {
    updateContentScripts(changes.custom_urls.newValue || []);
  }
});

// 初始化/安装时注册
chrome.runtime.onInstalled.addListener(async (details) => {
  const { custom_urls } = await chrome.storage.sync.get('custom_urls');
  updateContentScripts(custom_urls || []);

  // 仅首次安装时开启新手教程
  if (details.reason === 'install') {
    chrome.storage.local.set({ 'llm-nav-tutorial-enabled': true });
  }
});

// 浏览器启动时注册
chrome.runtime.onStartup.addListener(async () => {
    const { custom_urls } = await chrome.storage.sync.get('custom_urls');
    updateContentScripts(custom_urls || []);
});

// 监听快捷键命令
chrome.commands.onCommand.addListener((command) => {
  
  // 获取当前活动的 tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      // 向 content script 发送消息
      let message;
      
      switch (command) {
        case 'prev-answer':
          message = { type: 'LLM_NAV_PREV_ANSWER' };
          break;
        case 'next-answer':
          message = { type: 'LLM_NAV_NEXT_ANSWER' };
          break;
        case 'toggle-ui':
          message = { type: 'LLM_NAV_TOGGLE_UI' };
          break;
        case 'toggle-pin':
          message = { type: 'LLM_NAV_TOGGLE_PIN' };
          break;
        default:
          return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, message).catch((error) => {
        // 静默处理错误，避免控制台污染
        // 错误通常发生在content script未加载时
      });
    }
  });
});

// 打开插件选项页（供 content script 调用）
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'LLM_NAV_OPEN_OPTIONS') return;

  try {
    chrome.runtime.openOptionsPage(() => {
      sendResponse({ success: !chrome.runtime.lastError });
    });
  } catch (err) {
    sendResponse({ success: false, error: String(err) });
  }

  return true;
});

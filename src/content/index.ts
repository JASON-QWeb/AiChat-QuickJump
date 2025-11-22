// Content Script
console.log('LLM Answer Navigator: Content script loaded');

/**
 * 检测当前页面是否是 ChatGPT 对话页面
 */
function isChatGPTPage(): boolean {
  const { hostname, pathname } = window.location;
  
  // 检测是否是 ChatGPT 域名
  const isChatGPT = hostname === 'chatgpt.com' || hostname === 'chat.openai.com';
  
  // 检测是否是对话页面（路径包含 /c/ 或者是根路径）
  const isConversationPage = pathname === '/' || pathname.startsWith('/c/');
  
  return isChatGPT && isConversationPage;
}

/**
 * 初始化导航功能
 */
function init() {
  // 检测当前页面是否支持
  if (!isChatGPTPage()) {
    console.log('LLM Answer Navigator: 当前页面不是 ChatGPT 对话页面，跳过初始化');
    return;
  }
  
  console.log('LLM Answer Navigator: ChatGPT 页面已检测到，准备初始化');
  
  // 后续将在这里添加核心逻辑
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in content script:', message);
  
  if (message.type === 'LLM_NAV_PREV_ANSWER') {
    console.log('Navigate to previous answer');
    // 后续实现
  } else if (message.type === 'LLM_NAV_NEXT_ANSWER') {
    console.log('Navigate to next answer');
    // 后续实现
  }
});


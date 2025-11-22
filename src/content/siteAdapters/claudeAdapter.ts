import type { SiteAdapter, PromptAnswerPair } from './index';

export const claudeAdapter: SiteAdapter = {
  name: 'Claude',
  
  isSupported(location: Location): boolean {
    return location.hostname === 'claude.ai' || location.hostname.endsWith('.claude.ai');
  },

  getPromptAnswerPairs(root: Document | HTMLElement): PromptAnswerPair[] {
    const pairs: PromptAnswerPair[] = [];
    
    // Claude 的用户消息通常包含特定的类名或属性
    // 目前 Claude 的 DOM 结构经常变动，尝试几种常见的选择器
    const userMessages = Array.from(root.querySelectorAll([
      '.font-user-message', // 常见类名
      '[data-testid="user-message"]', // 测试 ID
      'div.group.grid.grid-cols-1' // 某些版本的容器
    ].join(','))).filter(el => {
      // 过滤掉非用户消息（如果使用了通用选择器）
      // Claude 的用户消息通常有特定的背景色或图标，或者 textContent 内容
      // 这里做一个简单的文本长度检查
      return el.textContent && el.textContent.trim().length > 0;
    });

    // 如果上述特定选择器找不到，尝试通用策略：查找包含 "User" 或头像的容器
    // (为了简化，这里暂时假设上述选择器能覆盖大部分情况，或者依赖后续的通用逻辑)

    userMessages.forEach((msg, index) => {
      const element = msg as HTMLElement;
      // 尝试找到对应的 AI 回答
      // 在 Claude 中，回答通常紧跟在用户消息后面
      
      // 简单的偏移量计算
      const rect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const topOffset = rect.top + scrollTop;

      pairs.push({
        id: `claude-turn-${index}`,
        promptNode: element,
        promptText: element.textContent?.trim() || '',
        answerNode: element, // 暂时指向自己，跳转逻辑主要依赖 promptNode
        topOffset
      });
    });

    console.log(`🔍 Claude Adapter: 扫描到 ${pairs.length} 个用户问题`);
    return pairs;
  }
};


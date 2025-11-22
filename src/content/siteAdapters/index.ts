/**
 * Prompt-Answer 成对数据结构
 * 用于时间线导航，记录用户问题和对应的 AI 回答
 */
export interface PromptAnswerPair {
  /** 对话内唯一 ID（用于标记等功能） */
  id: string;
  /** 用户问题所在的 DOM 节点 */
  promptNode: HTMLElement;
  /** 用户问题的文本内容 */
  promptText: string;
  /** 对应 AI 回答的 DOM 节点 */
  answerNode: HTMLElement;
  /** 问题在文档中的位置（用于排序） */
  topOffset: number;
}

/**
 * 站点适配器接口
 * 每个站点适配器需要实现这个接口
 * 
 * 如何添加新站点适配器：
 * 1. 创建新文件，例如 yourSiteAdapter.ts
 * 2. 实现 SiteAdapter 接口
 * 3. 在本文件中导入并添加到 adapters 数组
 * 4. 在 manifest.json 中添加站点的 URL 匹配规则
 * 
 * 详细说明请参考 ADAPTER_GUIDE.md
 */
export interface SiteAdapter {
  /**
   * 判断当前 URL 是否支持此适配器
   */
  isSupported(location: Location): boolean;
  
  /**
   * 在页面中查找所有用户问题节点（用于导航跳转）
   * @param root - 根节点，通常是 document 或某个容器元素
   * @returns 用户问题节点数组
   * @deprecated 建议使用 getPromptAnswerPairs 获取完整的对话对
   */
  findAllAnswers(root: Document | HTMLElement): HTMLElement[];
  
  /**
   * 获取页面中所有的「用户问题 + AI 回答」配对
   * @param root - 根节点，通常是 document 或某个容器元素
   * @returns Prompt-Answer 配对数组
   */
  getPromptAnswerPairs(root: Document | HTMLElement): PromptAnswerPair[];

  /**
   * 获取当前页面的主要滚动容器
   * 用于计算相对位置和监听滚动事件
   * @param root - 根节点
   */
  getScrollContainer?(root: Document | HTMLElement): HTMLElement;
  
  /**
   * 适配器名称
   */
  name: string;
}

// 导入所有适配器
import { chatgptAdapter } from './chatgptAdapter';
import { claudeAdapter } from './claudeAdapter';
import { geminiAdapter } from './geminiAdapter';

/**
 * 所有已注册的适配器列表
 * 添加新站点适配器时，只需导入并添加到这个数组
 */
const adapters: SiteAdapter[] = [
  chatgptAdapter,
  claudeAdapter,
  geminiAdapter
];

/**
 * 根据当前 URL 获取合适的适配器
 * @param location - 当前页面的 location 对象
 * @param customUrls - 可选的自定义 URL 列表
 * @returns 找到的适配器，如果没有匹配则返回 null
 */
export function getActiveAdapter(location: Location, customUrls: string[] = []): SiteAdapter | null {
  // 1. 检查内置适配器
  for (const adapter of adapters) {
    if (adapter.isSupported(location)) {
      return adapter;
    }
  }
  
  // 2. 检查自定义 URL
  // 如果匹配到自定义 URL，使用 ChatGPT 适配器（默认复用逻辑）
  if (customUrls.length > 0) {
    const hostname = location.hostname;
    if (customUrls.some(url => hostname === url || hostname.endsWith('.' + url))) {
      console.log('Matched custom URL, using ChatGPT adapter');
      // 创建一个新的适配器实例，或者直接复用 ChatGPT 适配器
      // 这里我们通过 Object.create 复用，但修改 name
      const customAdapter = Object.create(chatgptAdapter);
      customAdapter.name = 'Custom Site (ChatGPT Compatible)';
      // 覆盖 isSupported 确保它总是返回 true (因为外层已经匹配了)
      customAdapter.isSupported = () => true;
      return customAdapter;
    }
  }
  
  return null;
}

/**
 * 获取所有已注册的适配器
 */
export function getAllAdapters(): SiteAdapter[] {
  return [...adapters];
}


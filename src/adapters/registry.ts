import { PageContext, SkillVaultSettings } from '../domain/types';
import { AIAdapter } from './types';
import { ChatGPTAdapter } from './chatgpt';
import { ClaudeAdapter } from './claude';
import { GeminiAdapter } from './gemini';
import { GenericAdapter } from './generic';

export class AdapterRegistry {
  private adapters: AIAdapter[] = [];
  private static instance: AdapterRegistry;

  constructor() {
    this.register(new ChatGPTAdapter());
    this.register(new ClaudeAdapter());
    this.register(new GeminiAdapter());
    this.register(new GenericAdapter());
  }

  public static getInstance(): AdapterRegistry {
    if (!AdapterRegistry.instance) {
      AdapterRegistry.instance = new AdapterRegistry();
    }
    return AdapterRegistry.instance;
  }

  register(adapter: AIAdapter) {
    this.adapters.push(adapter);
  }

  /**
   * Finds the adapter with the highest confidence score for the given page context.
   */
  getBestAdapter(context: PageContext, settings?: SkillVaultSettings): AIAdapter | null {
    let bestAdapter: AIAdapter | null = null;
    let highestConfidence = 0;

    for (const adapter of this.adapters) {
      if (settings) {
        const enabled = {
          chatgpt: settings.enableChatGPT,
          claude: settings.enableClaude,
          gemini: settings.enableGemini,
        };
        if (adapter.id in enabled && !enabled[adapter.id as keyof typeof enabled]) continue;
        if (adapter.id === 'generic') {
          if (
            settings.customProviderUrls.includes(new URL(context.url).origin) &&
            highestConfidence === 0
          ) {
            bestAdapter = adapter;
            highestConfidence = 0.3;
          }
          continue;
        }
      }
      const confidence = adapter.match(context);
      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        bestAdapter = adapter;
      }
    }

    return bestAdapter;
  }

  getAdapterById(id: string): AIAdapter | null {
    return this.adapters.find((a) => a.id === id) || null;
  }
}

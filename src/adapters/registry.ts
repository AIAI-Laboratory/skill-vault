import { PageContext } from '../domain/types';
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
  getBestAdapter(context: PageContext): AIAdapter | null {
    let bestAdapter: AIAdapter | null = null;
    let highestConfidence = 0;

    for (const adapter of this.adapters) {
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

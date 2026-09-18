// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdapterRegistry } from '../../src/adapters/registry';
import { GenericAdapter } from '../../src/adapters/generic';
import { DEFAULT_SETTINGS } from '../../src/domain/types';

const context = (url: string) => ({ url, hostname: new URL(url).hostname, title: 'Chat' });
afterEach(() => {
  document.body.innerHTML = '';
});

describe('custom provider adapters', () => {
  it('selects a custom provider before a composer has mounted and restricts the origin', () => {
    const registry = new AdapterRegistry();
    const settings = { ...DEFAULT_SETTINGS, customProviderUrls: ['http://localhost:3000'] };
    expect(registry.getBestAdapter(context('http://localhost:3000/chat'), settings)?.id).toBe(
      'generic'
    );
    document.body.innerHTML = '<textarea></textarea>';
    expect(registry.getBestAdapter(context('http://localhost:4000/chat'), settings)).toBeNull();
    expect(registry.getBestAdapter(context('https://example.com'), settings)).toBeNull();
    expect(registry.getBestAdapter(context('http://localhost:3000'), DEFAULT_SETTINGS)).toBeNull();
  });
  it('respects disabled built-in providers without falling back to generic', () => {
    document.body.innerHTML = '<textarea></textarea>';
    const registry = new AdapterRegistry();
    expect(
      registry.getBestAdapter(context('https://chatgpt.com'), {
        ...DEFAULT_SETTINGS,
        enableChatGPT: false,
      })
    ).toBeNull();
    expect(registry.getBestAdapter(context('https://chatgpt.com'), DEFAULT_SETTINGS)?.id).toBe(
      'chatgpt'
    );
  });
  it('observes focus changes and inserts a skill in the focused text area', async () => {
    document.body.innerHTML =
      '<textarea id="search"></textarea><textarea id="chat">/skill</textarea>';
    const adapter = new GenericAdapter();
    const callback = vi.fn();
    const dispose = adapter.observeComposer(callback);
    const chat = document.querySelector<HTMLTextAreaElement>('#chat')!;
    chat.focus();
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ element: chat }));
    await adapter.insertText('My prompt', { start: 0, end: 6 });
    expect(chat.value).toBe('My prompt');
    dispose();
  });
});

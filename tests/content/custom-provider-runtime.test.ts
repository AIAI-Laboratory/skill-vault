// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/domain/types';
import { sendExtensionMessage } from '../../src/infrastructure/messaging/client';
import { ContentRuntime } from '../../src/content/runtime';

vi.mock('../../src/infrastructure/messaging/client', () => ({ sendExtensionMessage: vi.fn() }));
vi.mock('../../src/content/palette/palette-ui', () => ({
  PaletteUI: class {
    setTheme = vi.fn();
    close = vi.fn();
    open = vi.fn();
    isPaletteOpen = () => false;
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('custom provider runtime', () => {
  it('attaches to a late composer and stops handling input after the provider is removed', async () => {
    const settings = { ...DEFAULT_SETTINGS, customProviderUrls: [window.location.origin] };
    const addListener = vi.fn();
    vi.stubGlobal('chrome', { storage: { onChanged: { addListener, removeListener: vi.fn() } } });
    vi.mocked(sendExtensionMessage).mockImplementation(
      async (type) => (type === 'SETTINGS_GET' ? settings : []) as never
    );
    const runtime = new ContentRuntime();
    runtime.init();
    await Promise.resolve();
    document.body.innerHTML = '<textarea></textarea>';
    const composer = document.querySelector('textarea')!;
    composer.focus();
    composer.value = '/skill';
    composer.selectionStart = 6;
    composer.dispatchEvent(new Event('input'));
    await Promise.resolve();
    expect(sendExtensionMessage).toHaveBeenCalledWith('SKILL_SEARCH', { query: '' });
    const settingsChange = addListener.mock.calls[0][0];
    settingsChange({ settings: { newValue: DEFAULT_SETTINGS } }, 'local');
    vi.mocked(sendExtensionMessage).mockClear();
    composer.dispatchEvent(new Event('input'));
    expect(sendExtensionMessage).not.toHaveBeenCalled();
    runtime.dispose();
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, Skill } from '../../src/domain/types';
import { sendExtensionMessage } from '../../src/infrastructure/messaging/client';
import { ContentRuntime } from '../../src/content/runtime';

let onSelectCallback: ((skill: Skill) => void) | null = null;

vi.mock('../../src/infrastructure/messaging/client', () => ({ sendExtensionMessage: vi.fn() }));
vi.mock('../../src/content/palette/palette-ui', () => ({
  PaletteUI: class {
    constructor(options: { onSelect: (skill: Skill) => void }) {
      onSelectCallback = options.onSelect;
    }
    setTheme = vi.fn();
    close = vi.fn();
    open = vi.fn();
    isPaletteOpen = () => false;
  },
}));

let runtime: ContentRuntime | undefined;

afterEach(() => {
  runtime?.dispose();
  runtime = undefined;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  document.body.innerHTML = '';
  onSelectCallback = null;
});

describe('runtime skill selection', () => {
  it.each([
    { shortcut: 'Review3', name: 'Code Reviewer', label: '🏷️ /𝚁𝚎𝚟𝚒𝚎𝚠𝟹' },
    { shortcut: undefined, name: 'Đọc Code 2', label: '🏷️ Đọ𝚌 𝙲𝚘𝚍𝚎 𝟸' },
  ])(
    'expands monospace label $label with surrounding text intact',
    async ({ shortcut, name, label }) => {
      const settings = { ...DEFAULT_SETTINGS, customProviderUrls: [window.location.origin] };
      const addListener = vi.fn();
      vi.stubGlobal('chrome', { storage: { onChanged: { addListener, removeListener: vi.fn() } } });
      vi.mocked(sendExtensionMessage).mockImplementation(
        async (type) => (type === 'SETTINGS_GET' ? settings : []) as never
      );

      runtime = new ContentRuntime();
      runtime.init();
      await Promise.resolve();

      document.body.innerHTML = '<textarea id="chat"></textarea>';
      const composer = document.querySelector<HTMLTextAreaElement>('#chat')!;
      composer.focus();
      const prefix = 'Please review:\n';
      composer.value = `${prefix}/skill`;
      composer.selectionStart = composer.value.length;
      composer.selectionEnd = composer.value.length;

      composer.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();

      const sampleSkill: Skill = {
        id: 'skill-1',
        schemaVersion: 1,
        variables: [],
        usage: { count: 0 },
        name,
        shortcut,
        content: 'Review the following code thoroughly.',
        tags: [],
        favorite: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      expect(onSelectCallback).toBeDefined();
      onSelectCallback!(sampleSkill);
      await Promise.resolve();

      expect(composer.value).toBe(`${prefix}${label}`);

      // Repeated labels exercise UTF-16 replacement offsets in descending order.
      composer.value += `\nconst a = 1;\n${label}`;

      // Pressing Enter in the composer triggers label expansion
      composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await Promise.resolve();

      expect(composer.value).toBe(
        `${prefix}${sampleSkill.content}\nconst a = 1;\n${sampleSkill.content}`
      );
    }
  );
});

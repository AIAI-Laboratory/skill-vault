// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ContentRuntime } from '../../src/content/runtime';
import { DEFAULT_SETTINGS } from '../../src/domain/types';
import { SEED_SKILLS } from '../../src/infrastructure/storage/seed-data';
import { SKILL_DRAG_TYPE, writeSkillDragData } from '../../src/infrastructure/skill-drag';
import { sendExtensionMessage } from '../../src/infrastructure/messaging/client';

vi.mock('../../src/infrastructure/messaging/client', () => ({ sendExtensionMessage: vi.fn() }));

const skill = { ...SEED_SKILLS[0], content: 'Review on {{provider}}: {{page_title}}' };
let runtime: ContentRuntime;
let composer: HTMLTextAreaElement;
let settingsChanged: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;

beforeEach(async () => {
  document.body.innerHTML = '<textarea aria-label="Chat"></textarea><button>Send</button>';
  document.title = 'Drop test';
  composer = document.querySelector('textarea')!;
  composer.focus();
  vi.stubGlobal('chrome', {
    storage: {
      onChanged: {
        addListener: (callback: typeof settingsChanged) => {
          settingsChanged = callback;
        },
        removeListener: vi.fn(),
      },
    },
  });
  vi.mocked(sendExtensionMessage).mockImplementation(async (type, payload) => {
    if (type === 'SETTINGS_GET')
      return { ...DEFAULT_SETTINGS, customProviderUrls: [window.location.origin] } as never;
    if (type === 'SKILL_GET')
      return ((payload as { id: string }).id === skill.id ? skill : null) as never;
    if (type === 'SKILL_SEARCH') return [{ skill, score: 1 }] as never;
    return true as never;
  });
  runtime = new ContentRuntime();
  runtime.init();
  await Promise.resolve();
});

afterEach(() => {
  runtime.dispose();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  Reflect.deleteProperty(document, 'execCommand');
});

function drag(type: string, transfer: DataTransfer, target: Element = composer) {
  const event = new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true });
  // Happy DOM currently omits DragEventInit.dataTransfer.
  Object.defineProperty(event, 'dataTransfer', { value: transfer });
  target.dispatchEvent(event);
  return event;
}

function transfer() {
  const data = new DataTransfer();
  writeSkillDragData(data, skill);
  return data;
}

it('drops into a chat through the same label, expansion and usage flow as palette selection', async () => {
  const send = vi.fn();
  document.querySelector('button')!.addEventListener('click', send);
  const data = transfer();
  // Ignore forged/stale prompt text: only the skill id is used by the extension.
  data.setData('text/plain', 'Untrusted drag content');
  expect(drag('dragover', data).defaultPrevented).toBe(true);
  expect(data.dropEffect).toBe('copy');
  expect(composer.hasAttribute('data-skill-vault-drop-target')).toBe(true);
  expect(drag('drop', data).defaultPrevented).toBe(true);
  await vi.waitFor(() => expect(composer.value).toBe('🏷️ /review'));
  expect(composer.hasAttribute('data-skill-vault-drop-target')).toBe(false);
  expect(sendExtensionMessage).toHaveBeenCalledWith('SKILL_GET', { id: skill.id });
  expect(sendExtensionMessage).toHaveBeenCalledWith('SKILL_RECORD_USAGE', { id: skill.id });
  expect(send).not.toHaveBeenCalled();
  composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(composer.value).toBe('Review on Generic AI: Drop test'));

  vi.mocked(sendExtensionMessage).mockClear();
  composer.value = '/skill review';
  composer.setSelectionRange(composer.value.length, composer.value.length);
  composer.dispatchEvent(new Event('input', { bubbles: true }));
  await vi.waitFor(() => expect(document.querySelector('skill-vault-root')).not.toBeNull());
  document
    .querySelector('skill-vault-root')!
    .shadowRoot!.querySelector<HTMLElement>('[role="option"]')!
    .click();
  await vi.waitFor(() => expect(composer.value).toBe('🏷️ /review'));
  expect(
    vi.mocked(sendExtensionMessage).mock.calls.filter(([type]) => type === 'SKILL_RECORD_USAGE')
  ).toHaveLength(1);
});

it('preserves draft text, replaces a trailing /skill command and accepts a newly mounted composer', async () => {
  composer.value = 'My draft';
  drag('drop', transfer());
  await vi.waitFor(() => expect(composer.value).toBe('My draft\n\n🏷️ /review'));
  composer.value = 'My draft\n/skill review';
  composer.setSelectionRange(0, 0);
  drag('drop', transfer());
  await vi.waitFor(() => expect(composer.value).toBe('My draft\n🏷️ /review'));

  const next = document.createElement('textarea');
  composer.replaceWith(next);
  drag('drop', transfer(), next);
  await vi.waitFor(() => expect(next.value).toBe('🏷️ /review'));
});

it('supports a contenteditable composer and expands only the inserted label', async () => {
  // Model the browser's native insertText command, which Happy DOM does not implement.
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: (command: string, _ui: boolean, text: string) => {
      if (command === 'insertText') {
        const selection = window.getSelection()!;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      return true;
    },
  });
  const editor = document.createElement('div');
  editor.setAttribute('contenteditable', 'true');
  editor.textContent = 'Existing draft';
  composer.replaceWith(editor);
  drag('drop', transfer(), editor);
  await vi.waitFor(() => expect(editor.textContent).toBe('Existing draft\n\n🏷️ /review'));
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() =>
    expect(editor.textContent).toBe('Existing draft\n\nReview on Generic AI: Drop test')
  );
});

it('ignores normal text, files, readonly fields and drops after a provider is disabled', () => {
  const text = new DataTransfer();
  text.setData('text/plain', 'Ordinary text');
  expect(drag('dragover', text).defaultPrevented).toBe(false);
  expect(drag('drop', text).defaultPrevented).toBe(false);
  const file = transfer();
  file.items.add(new File(['test'], 'test.txt'));
  expect(drag('drop', file).defaultPrevented).toBe(false);
  composer.readOnly = true;
  expect(drag('drop', transfer()).defaultPrevented).toBe(false);
  composer.readOnly = false;
  settingsChanged({ settings: { newValue: DEFAULT_SETTINGS } }, 'local');
  expect(drag('drop', transfer()).defaultPrevented).toBe(false);
  expect(sendExtensionMessage).not.toHaveBeenCalledWith('SKILL_RECORD_USAGE', expect.anything());
});

it('does not insert or count deleted skills, failed reads or a composer removed during lookup', async () => {
  const missing = transfer();
  missing.setData(SKILL_DRAG_TYPE, 'deleted-skill');
  drag('drop', missing);
  await Promise.resolve();
  expect(composer.value).toBe('');
  vi.mocked(sendExtensionMessage).mockRejectedValueOnce(new Error('Vault unavailable'));
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  drag('drop', transfer());
  await Promise.resolve();
  expect(composer.value).toBe('');
  drag('drop', transfer());
  composer.remove();
  await Promise.resolve();
  expect(sendExtensionMessage).not.toHaveBeenCalledWith('SKILL_RECORD_USAGE', expect.anything());
});

it('cleans up drop feedback and stops intercepting drops on dispose', () => {
  drag('dragover', transfer());
  drag('dragleave', transfer());
  expect(composer.hasAttribute('data-skill-vault-drop-target')).toBe(false);
  drag('dragover', transfer());
  runtime.dispose();
  expect(composer.hasAttribute('data-skill-vault-drop-target')).toBe(false);
  expect(
    [...document.head.querySelectorAll('style')].some((node) =>
      node.textContent?.includes('data-skill-vault-drop-target')
    )
  ).toBe(false);
  expect(drag('drop', transfer()).defaultPrevented).toBe(false);
});

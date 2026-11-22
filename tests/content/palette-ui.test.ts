// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaletteUI } from '../../src/content/palette/palette-ui';
import { SKILL_DRAG_TYPE } from '../../src/infrastructure/messaging/protocol';
import { SEED_SKILLS } from '../../src/infrastructure/storage/seed-data';

const results = SEED_SKILLS.map((skill) => ({ skill, score: 1 }));
let composer: HTMLTextAreaElement;
let palette: PaletteUI;
const onSelect = vi.fn();
const onClose = vi.fn();
const onSearch = vi.fn(async () => results);
const onCopy = vi.fn();
const onDragDrop = vi.fn();
const shadow = () => document.querySelector('skill-vault-root')!.shadowRoot!;
const key = (value: string) => new KeyboardEvent('keydown', { key: value, cancelable: true });

beforeEach(() => {
  vi.clearAllMocks();
  composer = document.createElement('textarea');
  document.body.appendChild(composer);
  composer.focus();
  vi.spyOn(composer, 'getBoundingClientRect').mockReturnValue({
    top: 600,
    bottom: 650,
    left: 40,
    right: 540,
    width: 500,
    height: 50,
    x: 40,
    y: 600,
    toJSON: () => ({}),
  });
  palette = new PaletteUI({ onSelect, onClose, onSearch, onCopy, onDragDrop });
});
afterEach(() => {
  palette.close();
  composer.remove();
  vi.restoreAllMocks();
});

describe('in-chat skill palette', () => {
  it('does not attach layout listeners when the composer has been removed', () => {
    const add = vi.spyOn(window, 'addEventListener');
    composer.remove();
    palette.open(composer, '', results);
    expect(palette.isPaletteOpen()).toBe(false);
    expect(add).not.toHaveBeenCalledWith('resize', expect.any(Function));
    expect(add).not.toHaveBeenCalledWith('scroll', expect.any(Function), true);
  });

  it('supports wrapping keyboard navigation and inserts the selected skill once', () => {
    palette.open(composer, '', results);
    expect(shadow().querySelectorAll('[role="option"]')).toHaveLength(4);
    const up = key('ArrowUp');
    expect(palette.handleKeyDown(up)).toBe(true);
    expect(up.defaultPrevented).toBe(true);
    expect(shadow().querySelector('[aria-selected="true"]')?.id).toBe('sv-option-3');
    expect(shadow().querySelector('[role="listbox"]')?.getAttribute('aria-activedescendant')).toBe(
      'sv-option-3'
    );
    palette.handleKeyDown(key('Enter'));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(SEED_SKILLS[3]);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('skill-vault-root')).toBeNull();
  });

  it('preserves search focus on palette chrome mouse down and allows native dragging on items' /**
   * Verifies that mousedown on palette chrome prevents focus loss, while mousedown on a
   * draggable skill item allows native drag-and-drop and tracks active interaction.
   */, () => {
    palette.open(composer, '', results);
    const copyButton = shadow().querySelectorAll('.sv-copy-btn')[1];
    const chromeMouse = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    copyButton.dispatchEvent(chromeMouse);
    expect(chromeMouse.defaultPrevented).toBe(true);
    expect(shadow().activeElement).toBe(shadow().querySelector('.sv-search-input'));

    const option = shadow().querySelectorAll('.sv-item')[1];
    const itemMouse = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    option.dispatchEvent(itemMouse);
    expect(itemMouse.defaultPrevented).toBe(false);
    expect(palette.isInteracting()).toBe(true);
    window.dispatchEvent(new MouseEvent('mouseup'));
    expect(palette.isInteracting()).toBe(false);

    option.dispatchEvent(new MouseEvent('mousemove'));
    palette.handleKeyDown(key('Tab'));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(SEED_SKILLS[1]);
  });

  it('inserts an option by click', () => {
    palette.open(composer, '', results);
    shadow().querySelectorAll<HTMLElement>('.sv-item')[2].click();
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(SEED_SKILLS[2]);
    expect(palette.isPaletteOpen()).toBe(false);
  });

  it.each(['Escape', 'close button'])('closes with %s without inserting', (method) => {
    palette.open(composer, '', results);
    if (method === 'Escape') palette.handleKeyDown(key('Escape'));
    else shadow().querySelector<HTMLButtonElement>('.sv-close')!.click();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(palette.isPaletteOpen()).toBe(false);
  });

  it('does not consume Enter while composing Vietnamese text', () => {
    palette.open(composer, '', results);
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      cancelable: true,
    });
    expect(palette.handleKeyDown(event)).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('resets selection after filtering and handles no matches', () => {
    palette.open(composer, '', results);
    palette.handleKeyDown(key('ArrowDown'));
    palette.update('rewrite', [results[2]]);
    expect(shadow().querySelector('[aria-selected="true"]')?.textContent).toContain(
      'Professional Rewrite'
    );
    palette.update('missing', []);
    expect(shadow().textContent).toContain('No matching skills');
    expect(shadow().querySelector('[role="option"]')).toBeNull();
    expect(palette.handleKeyDown(key('Enter'))).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('escapes skill content and searches rather than interpreting HTML', () => {
    const content = '<img src=x onerror="alert(1)">';
    const skill = {
      ...SEED_SKILLS[0],
      name: content,
      description: content,
      shortcut: content,
      tags: [content],
    };
    palette.open(composer, content, [{ skill, score: 1 }]);
    expect(shadow().querySelector('img')).toBeNull();
    expect(shadow().querySelector('.sv-item-name')?.textContent).toBe(content);
    expect(shadow().querySelector<HTMLInputElement>('.sv-search-input')?.value).toBe(content);
  });

  it('applies theme changes while open and preserves them when reopened', () => {
    palette.setTheme('light');
    palette.open(composer, '', results);
    expect(document.querySelector('skill-vault-root')?.getAttribute('data-theme')).toBe('light');
    palette.setTheme('system');
    expect(document.querySelector('skill-vault-root')?.getAttribute('data-theme')).toBe('system');
    palette.close();
    palette.open(composer, '', results);
    expect(document.querySelector('skill-vault-root')?.getAttribute('data-theme')).toBe('system');
  });

  it('clamps to a narrow viewport and removes layout listeners when closed', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    vi.stubGlobal('innerWidth', 320);
    try {
      palette.open(composer, '', results);
      const host = document.querySelector<HTMLElement>('skill-vault-root')!;
      expect(host.style.width).toBe('296px');
      expect(host.style.left).toBe('12px');
      palette.close();
      expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('copies a skill prompt from the copy button without inserting or closing the palette' /**
   * Verifies that clicking a skill's copy button writes its prompt to the clipboard,
   * shows temporary confirmation state, notifies `onCopy`, and keeps the palette open.
   */, async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    try {
      palette.open(composer, '', results);
      const button = shadow().querySelectorAll<HTMLButtonElement>('.sv-copy-btn')[1];
      button.click();
      await Promise.resolve();
      await Promise.resolve();
      expect(writeText).toHaveBeenCalledExactlyOnceWith(SEED_SKILLS[1].content);
      expect(onCopy).toHaveBeenCalledExactlyOnceWith(SEED_SKILLS[1]);
      expect(onSelect).not.toHaveBeenCalled();
      expect(palette.isPaletteOpen()).toBe(true);
      expect(button.classList.contains('copied')).toBe(true);
      expect(button.getAttribute('title')).toBe('Copied');

      vi.advanceTimersByTime(1500);
      expect(button.classList.contains('copied')).toBe(false);
      expect(button.getAttribute('title')).toBe('Copy prompt');
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to execCommand copy when the Clipboard API is rejected' /**
   * Verifies that clipboard copy falls back to `document.execCommand('copy')` if
   * `navigator.clipboard.writeText` throws an error.
   */, async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });
    palette.open(composer, '', results);
    const button = shadow().querySelectorAll<HTMLButtonElement>('.sv-copy-btn')[0];
    button.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(onCopy).toHaveBeenCalledExactlyOnceWith(SEED_SKILLS[0]);
    expect(button.classList.contains('copied')).toBe(true);
  });

  it('supports dragging a skill item with both skill ID and plain-text prompt payloads' /**
   * Verifies that dragging a skill item sets both the custom Skill Vault drag type and
   * plain-text prompt payload, keeps interaction state active, and closes on successful drop.
   */, () => {
    palette.open(composer, '', results);
    const item = shadow().querySelectorAll<HTMLElement>('.sv-item')[2];
    expect(item.getAttribute('draggable')).toBe('true');

    const data = new Map<string, string>();
    const dataTransfer = {
      /**
       * Stores drag payload data by MIME type.
       *
       * @param type - Drag MIME type.
       * @param value - Payload string to associate with the type.
       */
      setData: (type: string, value: string) => {
        data.set(type, value);
      },
      effectAllowed: 'none',
      dropEffect: 'copy',
    };
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
    item.dispatchEvent(dragStart);

    expect(data.get(SKILL_DRAG_TYPE)).toBe(SEED_SKILLS[2].id);
    expect(data.get('text/plain')).toBe(SEED_SKILLS[2].content);
    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(palette.isInteracting()).toBe(true);
    expect(item.classList.contains('dragging')).toBe(true);

    const cancelledEnd = new Event('dragend', { bubbles: true });
    Object.defineProperty(cancelledEnd, 'dataTransfer', { value: { dropEffect: 'none' } });
    item.dispatchEvent(cancelledEnd);
    expect(palette.isInteracting()).toBe(false);
    expect(palette.isPaletteOpen()).toBe(true);
    expect(onDragDrop).not.toHaveBeenCalled();

    item.dispatchEvent(dragStart);
    const droppedEnd = new Event('dragend', { bubbles: true });
    Object.defineProperty(droppedEnd, 'dataTransfer', { value: { dropEffect: 'copy' } });
    item.dispatchEvent(droppedEnd);
    expect(onDragDrop).toHaveBeenCalledExactlyOnceWith(SEED_SKILLS[2]);
    expect(palette.isPaletteOpen()).toBe(false);
  });

  it('prevents dragstart when initiated from the copy button' /**
   * Verifies that starting a drag on the inline copy button is cancelled so dragging
   * only starts from the skill item body.
   */, () => {
    palette.open(composer, '', results);
    const button = shadow().querySelectorAll<HTMLButtonElement>('.sv-copy-btn')[0];
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
    button.dispatchEvent(dragStart);
    expect(dragStart.defaultPrevented).toBe(true);
    expect(palette.isInteracting()).toBe(false);
  });
});

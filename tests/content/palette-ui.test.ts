// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaletteUI } from '../../src/content/palette/palette-ui';
import { SEED_SKILLS } from '../../src/infrastructure/storage/seed-data';

const results = SEED_SKILLS.map((skill) => ({ skill, score: 1 }));
let composer: HTMLTextAreaElement;
let palette: PaletteUI;
const onSelect = vi.fn();
const onClose = vi.fn();
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
  palette = new PaletteUI({ onSelect, onClose });
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

  it('keeps composer focus on mouse down and inserts the hovered result with Tab', () => {
    palette.open(composer, '', results);
    const option = shadow().querySelectorAll('.sv-item')[1];
    const mouse = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    option.dispatchEvent(mouse);
    expect(mouse.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(composer);
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
    expect(shadow().querySelector('.sv-search-text')?.textContent).toBe(content);
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
});

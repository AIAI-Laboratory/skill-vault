// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillEditor } from '../../src/sidepanel/components/SkillEditor';
import { TooltipProvider } from '../../src/components/ui/tooltip';
const { format } = vi.hoisted(() => ({ format: vi.fn() }));
vi.mock('../../src/infrastructure/ai/gemini-format', () => ({ formatSkillWithGemini: format }));
let root: Root;
let container: HTMLDivElement;
const save = vi.fn();
const initialDraftContent = 'Review code.\nKeep it safe.';
const formatted = {
  name: 'Review',
  description: 'Review safely',
  shortcut: 'review',
  tags: ['coding'],
  content: '# Review code.\n\n- Keep it safe.',
};
const button = (text: string) =>
  [...document.querySelectorAll('button')].find((node) => node.textContent === text)!;
const prompt = () => document.querySelector<HTMLTextAreaElement>('#skill-content')!;
async function render(configured = true) {
  await act(async () =>
    root.render(
      <TooltipProvider>
        <SkillEditor
          geminiConfigured={configured}
          onGeminiKeyChanged={vi.fn()}
          initialDraftContent={initialDraftContent}
          onSave={save}
          onCancel={vi.fn()}
        />
      </TooltipProvider>
    )
  );
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  format.mockResolvedValue(formatted);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
describe('Improve by AI editor flow', () => {
  it('disables formatting without a key and opens key setup without losing the draft', async () => {
    await render(false);
    expect(button('Improve by AI').disabled).toBe(true);
    expect(
      button('Improve by AI').closest('[data-slot=field]')?.querySelector('#skill-content')
    ).toBe(prompt());
    expect(
      [...container.querySelectorAll('button')].filter(
        (node) => node.textContent === 'Improve by AI'
      )
    ).toHaveLength(1);
    expect(container.textContent).not.toContain('Detect template');
    expect(
      document.querySelector('[aria-label="Add a Gemini API key to enable Improve by AI"]')
    ).not.toBeNull();
    await act(async () => button('Add API key').click());
    expect(document.querySelector('#gemini-api-key')).not.toBeNull();
    expect(prompt().value).toBe(initialDraftContent);
    expect(format).not.toHaveBeenCalled();
  });
  it('previews without mutating or saving, then applies only when requested', async () => {
    await render();
    await act(async () => button('Improve by AI').click());
    const dialog = document.querySelector('[role=dialog]');
    expect(dialog?.textContent).toContain('Review AI suggestions');
    expect(dialog?.contains(document.querySelector('#formatted-prompt'))).toBe(true);
    expect(prompt().value).toBe(initialDraftContent);
    expect(document.querySelector<HTMLTextAreaElement>('#formatted-prompt')?.value).toBe(
      formatted.content
    );
    expect(save).not.toHaveBeenCalled();
    await act(async () => button('Apply format').click());
    expect(prompt().value).toBe(formatted.content);
    expect(document.querySelector<HTMLInputElement>('#skill-name')?.value).toBe('Review');
    expect(save).not.toHaveBeenCalled();
    expect(document.querySelector('#formatted-prompt')).toBeNull();
  });
  it('keeps the draft when preview is discarded or the request fails', async () => {
    await render();
    await act(async () => button('Improve by AI').click());
    await act(async () => button('Discard').click());
    expect(prompt().value).toBe(initialDraftContent);
    format.mockRejectedValueOnce(new Error('Gemini quota exceeded.'));
    await act(async () => button('Improve by AI').click());
    expect(container.textContent).toContain('Gemini quota exceeded.');
    expect(prompt().value).toBe(initialDraftContent);
    expect(save).not.toHaveBeenCalled();
  });
  it('dismisses the review with Escape without changing the draft', async () => {
    await render();
    await act(async () => button('Improve by AI').click());
    await act(async () => {
      document
        .querySelector('[role=dialog]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(prompt().value).toBe(initialDraftContent);
    expect(document.querySelector('#formatted-prompt')).toBeNull();
  });
  it('blocks saving and field edits while formatting, and aborts on unmount', async () => {
    format.mockImplementation(() => new Promise(() => {}));
    await render();
    await act(async () => button('Improve by AI').click());
    expect(button('Save skill').disabled).toBe(true);
    expect(prompt().closest('fieldset')?.disabled).toBe(true);
    expect(button('Formatting…').disabled).toBe(true);
    const signal = format.mock.calls[0][1] as AbortSignal;
    await act(async () => root.render(null));
    expect(signal.aborted).toBe(true);
  });
});

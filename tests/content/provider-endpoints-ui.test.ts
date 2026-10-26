// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentRuntime } from '../../src/content/runtime';
import { toMathematicalMonospace } from '../../src/domain/monospace';
import { DEFAULT_SETTINGS, Skill } from '../../src/domain/types';
import { sendExtensionMessage } from '../../src/infrastructure/messaging/client';

vi.mock(
  '../../src/infrastructure/messaging/client',
  /**
   * Provides a mocked extension messaging module for content runtime UI tests.
   *
   * @returns Mocked module exports with `sendExtensionMessage`.
   */
  () => ({ sendExtensionMessage: vi.fn() })
);

interface ProviderEndpointCase {
  name: string;
  url: string;
  html: string;
  composerSelector: string;
  expectedLineBreakCommand: 'insertLineBreak' | 'insertParagraph';
}

const SAMPLE_SKILL: Skill = {
  id: 'skill-review',
  schemaVersion: 1,
  name: 'Code Review',
  shortcut: 'review',
  description: 'Review code changes',
  content: 'Review the following code thoroughly.',
  tags: ['code'],
  variables: [],
  favorite: true,
  usage: { count: 0 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const ENDPOINT_CASES: ProviderEndpointCase[] = [
  {
    name: 'ChatGPT',
    url: 'https://chatgpt.com/c/test-session',
    html: '<div id="prompt-textarea" contenteditable="true"><p></p></div>',
    composerSelector: '#prompt-textarea',
    expectedLineBreakCommand: 'insertParagraph',
  },
  {
    name: 'Claude',
    url: 'https://claude.ai/new',
    html: '<div class="ProseMirror" contenteditable="true"><p></p></div>',
    composerSelector: 'div.ProseMirror[contenteditable="true"]',
    expectedLineBreakCommand: 'insertParagraph',
  },
  {
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    html: '<rich-textarea><div contenteditable="true"><p></p></div></rich-textarea>',
    composerSelector: 'rich-textarea div[contenteditable="true"]',
    expectedLineBreakCommand: 'insertParagraph',
  },
];

let activeRuntime: ContentRuntime | undefined;

/**
 * Installs a Range-backed `document.execCommand` simulator so contenteditable
 * insertion, deletion, and line break commands mutate the live DOM selection.
 *
 * @param root - The contenteditable composer element being edited.
 * @returns A spy wrapping `document.execCommand`.
 */
function installRangeExecCommandSimulator(root: HTMLElement) {
  /**
   * Inserts a string at the current DOM selection range and collapses the caret to its end.
   *
   * @param text - Text to insert at the active selection range.
   */
  const insertAtSelection = (text: string): void => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      root.append(document.createTextNode(text));
      return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStart(node, node.data.length);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  /**
   * Simulates browser `document.execCommand` operations on the active DOM selection.
   *
   * @param command - The editing command identifier.
   * @param _showUI - Legacy boolean flag ignored in modern browsers.
   * @param value - Optional string argument for commands such as `insertText`.
   * @returns True when the command is supported by the simulator.
   */
  const execCommandImpl = (command: string, _showUI?: boolean, value?: string): boolean => {
    const selection = window.getSelection();
    if (command === 'delete') {
      if (selection && selection.rangeCount > 0) {
        selection.getRangeAt(0).deleteContents();
      }
      return true;
    }
    if (command === 'insertText') {
      insertAtSelection(value ?? '');
      return true;
    }
    if (command === 'insertLineBreak' || command === 'insertParagraph') {
      insertAtSelection('\n');
      return true;
    }
    if (
      command === 'hiliteColor' ||
      command === 'backColor' ||
      command === 'foreColor' ||
      command === 'bold' ||
      command === 'removeFormat'
    ) {
      return true;
    }
    return false;
  };

  const spy = vi.fn(execCommandImpl);
  document.execCommand = spy;
  return spy;
}

/**
 * Places the DOM selection caret at the end of a target element's contents.
 *
 * @param element - Element whose trailing position should receive the caret.
 */
function placeCaretAtEnd(element: Node): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Verifies the end-to-end UI flow (slash command -> PaletteUI open -> click skill ->
 * insert monospace label with newline -> type follow-up text on next line -> expand on Enter)
 * for a specific AI chat provider endpoint.
 *
 * @param endpoint - Provider endpoint configuration under test.
 */
export async function verifyProviderEndpointUI(endpoint: ProviderEndpointCase): Promise<void> {
  window.location.href = endpoint.url;

  document.body.innerHTML = endpoint.html;
  const composer = document.querySelector<HTMLElement>(endpoint.composerSelector)!;
  /**
   * Returns a non-empty DOMRectList so visibility checks pass in happy-dom.
   *
   * @returns Mock client rect list with one visible rectangle.
   */
  composer.getClientRects = () => [{ width: 480, height: 48 }] as unknown as DOMRectList;
  /**
   * Returns a mock bounding client rectangle for anchoring the floating palette.
   *
   * @returns A mock DOMRect positioned inside the viewport.
   */
  composer.getBoundingClientRect = () =>
    ({
      top: 500,
      bottom: 548,
      left: 40,
      right: 520,
      width: 480,
      height: 48,
      x: 40,
      y: 500,
      /**
       * Serializes the mock DOMRect to a plain object.
       *
       * @returns Empty JSON representation for test rect.
       */
      toJSON: () => ({}),
    }) as DOMRect;

  const execCommandSpy = installRangeExecCommandSimulator(composer);

  vi.stubGlobal('chrome', {
    storage: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
    runtime: { onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
  });

  vi.mocked(sendExtensionMessage).mockImplementation(
    /**
     * Resolves mocked extension messages for settings lookup, skill search, and usage tracking.
     *
     * @param type - The protocol message type.
     * @returns A promise resolving to the mocked response for the given message type.
     */
    async (type) => {
      if (type === 'SETTINGS_GET') return DEFAULT_SETTINGS as never;
      if (type === 'SKILL_SEARCH') return [{ skill: SAMPLE_SKILL, score: 1 }] as never;
      return undefined as never;
    }
  );

  activeRuntime = new ContentRuntime();
  activeRuntime.init();
  await Promise.resolve();

  // 1. User types `/skill` into the provider composer
  const editableTarget = composer.querySelector('p') ?? composer;
  editableTarget.textContent = '/skill';
  composer.focus();
  placeCaretAtEnd(editableTarget);
  composer.dispatchEvent(new Event('input', { bubbles: true }));
  await Promise.resolve();

  // 2. PaletteUI opens in Shadow DOM with the matching skill option
  const paletteHost = document.querySelector('skill-vault-root');
  expect(paletteHost).not.toBeNull();
  const option = paletteHost!.shadowRoot!.querySelector<HTMLElement>('.sv-item');
  expect(option).not.toBeNull();
  expect(option!.textContent).toContain('Code Review');

  // 3. User clicks the skill option in the UI palette
  option!.click();
  await Promise.resolve();

  // Palette closes after selection
  expect(document.querySelector('skill-vault-root')).toBeNull();

  // Verify the monospace label and line break were inserted and caret moved to the next line
  const expectedLabel = toMathematicalMonospace(`🏷️ /${SAMPLE_SKILL.shortcut}`, true);
  expect(execCommandSpy).toHaveBeenCalledWith('insertText', false, expectedLabel);
  expect(execCommandSpy).toHaveBeenCalledWith(endpoint.expectedLineBreakCommand);
  expect(composer.textContent).toBe(`${expectedLabel}\n`);

  // 4. User types follow-up content at the current caret position (on the new line)
  document.execCommand('insertText', false, 'abcxyz....');
  expect(composer.textContent).toBe(`${expectedLabel}\nabcxyz....`);

  // 5. User presses Enter to submit; label expands in-place while keeping follow-up text on line 2
  composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await Promise.resolve();

  expect(composer.textContent).toBe(`${SAMPLE_SKILL.content}\nabcxyz....`);
}

/** Cleans up the active runtime, globals, and DOM after each endpoint test. */
function cleanupEndpointTest(): void {
  activeRuntime?.dispose();
  activeRuntime = undefined;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  document.body.innerHTML = '';
}

afterEach(cleanupEndpointTest);

/** Registers the UI verification test suite across the 3 core AI chat endpoints. */
function registerProviderEndpointsUISuite(): void {
  it.each(ENDPOINT_CASES)(
    'inserts skill on a new line and expands on submit in $name ($url)',
    verifyProviderEndpointUI
  );
}

describe('Provider endpoints UI skill insertion flow', registerProviderEndpointsUISuite);

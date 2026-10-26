// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { ChatGPTAdapter } from '../../src/adapters/chatgpt';
import { ClaudeAdapter } from '../../src/adapters/claude';
import { formatInsertedText } from '../../src/adapters/format-inserted-text';
import { GenericAdapter } from '../../src/adapters/generic';

/** Registers contenteditable newline insertion tests for ChatGPT, Claude, and Generic adapters. */
function registerNewlineSuite(): void {
  /** Verifies that ChatGPTAdapter splits a new paragraph without inline highlight marks. */
  const verifyChatGPTParagraphInsert = async (): Promise<void> => {
    document.body.innerHTML =
      '<div id="prompt-textarea" contenteditable="true"><p>/skill</p></div>';
    const editor = document.querySelector<HTMLElement>('#prompt-textarea')!;
    /**
     * Returns a single non-empty DOMRect list so the composer is treated as visible.
     *
     * @returns A mock DOMRectList with length 1.
     */
    editor.getClientRects = () => [{ width: 100, height: 20 }] as unknown as DOMRectList;
    editor.focus();

    document.execCommand = vi.fn().mockReturnValue(true);
    const adapter = new ChatGPTAdapter();

    await adapter.insertText('🏷️ /explain\n', { start: 0, end: 6 }, 'highlight');

    expect(document.execCommand).toHaveBeenCalledWith('insertText', false, '🏷️ /explain');
    expect(document.execCommand).toHaveBeenCalledWith('insertParagraph');
    expect(document.execCommand).not.toHaveBeenCalledWith(
      'hiliteColor',
      expect.anything(),
      expect.anything()
    );
  };

  /** Verifies that ClaudeAdapter and GenericAdapter emit paragraph breaks for trailing newlines. */
  const verifyClaudeAndGenericParagraphInsert = async (): Promise<void> => {
    document.body.innerHTML = '<div class="ProseMirror" contenteditable="true"><p>/skill</p></div>';
    const editor = document.querySelector<HTMLElement>('.ProseMirror')!;
    editor.focus();

    document.execCommand = vi.fn().mockReturnValue(true);
    const claude = new ClaudeAdapter();
    await claude.insertText('🏷️ /explain\n', { start: 0, end: 6 }, 'highlight');
    expect(document.execCommand).toHaveBeenCalledWith('insertParagraph');

    document.execCommand = vi.fn().mockReturnValue(true);
    const generic = new GenericAdapter();
    await generic.insertText('🏷️ /explain\n', { start: 0, end: 6 }, 'highlight');
    expect(document.execCommand).toHaveBeenCalledWith('insertParagraph');
  };

  /** Verifies highlight and plain formatting commands in formatInsertedText. */
  const verifyFormatInsertedText = (): void => {
    document.body.innerHTML = '<div id="ed" contenteditable="true">hello</div>';
    const textNode = document.getElementById('ed')!.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    document.execCommand = vi.fn().mockReturnValue(true);
    formatInsertedText('highlight');
    expect(document.execCommand).toHaveBeenCalledWith('hiliteColor', false, '#ffe08a');
    expect(document.execCommand).toHaveBeenCalledWith('removeFormat');

    formatInsertedText('plain');
    expect(document.execCommand).toHaveBeenCalledWith('removeFormat');
  };

  it(
    'triggers insertParagraph when inserting text with trailing newline in ChatGPT',
    verifyChatGPTParagraphInsert
  );
  it(
    'triggers insertParagraph when inserting text with trailing newline in Claude and Generic',
    verifyClaudeAndGenericParagraphInsert
  );
  it('formats and clears inline styles in formatInsertedText helper', verifyFormatInsertedText);
}

describe('Adapter newline handling in contenteditable', registerNewlineSuite);

// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { GeminiAdapter } from '../../src/adapters/gemini';

/** Registers unit tests for the Gemini chat composer adapter. */
function registerGeminiAdapterSuite(): void {
  /** Verifies host matching for Gemini and non-Gemini origins. */
  const verifyHostMatch = (): void => {
    const adapter = new GeminiAdapter();
    expect(
      adapter.match({
        url: 'https://gemini.google.com/app',
        hostname: 'gemini.google.com',
        title: 'Gemini',
      })
    ).toBe(1.0);
    expect(
      adapter.match({
        url: 'https://chatgpt.com',
        hostname: 'chatgpt.com',
        title: 'ChatGPT',
      })
    ).toBe(0);
  };

  /** Verifies that GeminiAdapter inserts the label and a paragraph break without inline highlight commands. */
  const verifyRichTextareaInsert = async (): Promise<void> => {
    document.body.innerHTML = `
        <rich-textarea>
          <div contenteditable="true">
            <p>/skill</p>
          </div>
        </rich-textarea>
      `;

    document.execCommand = vi.fn().mockReturnValue(true);
    const adapter = new GeminiAdapter();

    await adapter.insertText('🏷️ /explain\n', { start: 0, end: 6 }, 'highlight');

    expect(document.execCommand).not.toHaveBeenCalledWith(
      'hiliteColor',
      expect.anything(),
      expect.anything()
    );
    expect(document.execCommand).not.toHaveBeenCalledWith(
      'backColor',
      expect.anything(),
      expect.anything()
    );

    expect(document.execCommand).toHaveBeenCalledWith('insertText', false, '🏷️ /explain');
    expect(document.execCommand).toHaveBeenCalledWith('insertParagraph');
  };

  /** Verifies the DOM fallback when document.execCommand returns false in Gemini's editor. */
  const verifyParagraphFallback = async (): Promise<void> => {
    document.body.innerHTML = `
        <rich-textarea>
          <div contenteditable="true">
            <p>/skill</p>
          </div>
        </rich-textarea>
      `;

    document.execCommand = vi.fn().mockReturnValue(false);
    const adapter = new GeminiAdapter();

    await adapter.insertText('🏷️ /explain\n', { start: 0, end: 6 }, 'highlight');

    const editor = document.querySelector('rich-textarea div[contenteditable="true"]')!;
    const p = editor.querySelector('p');

    expect(p).not.toBeNull();
    expect(p!.textContent).toBe('🏷️ /explain');
    expect(document.execCommand).toHaveBeenCalledWith('insertLineBreak');
  };

  it('matches gemini.google.com host', verifyHostMatch);
  it(
    'inserts text into rich-textarea preserving <p> and does not invoke highlight execCommands',
    verifyRichTextareaInsert
  );
  it(
    'falls back safely to updating <p> text content without destroying <p> tag if execCommand fails',
    verifyParagraphFallback
  );
}

describe('GeminiAdapter', registerGeminiAdapterSuite);

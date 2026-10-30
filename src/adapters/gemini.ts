import { PageContext } from '../domain/types';
import {
  AIAdapter,
  ComposerHandle,
  CaretContext,
  TextRange,
  ComposerChangeCallback,
  DisposeFunction,
} from './types';
import { InsertedTextStyle } from './format-inserted-text';

export class GeminiAdapter implements AIAdapter {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';

  match(context: PageContext): number {
    const host = context.hostname.toLowerCase();
    if (host === 'gemini.google.com' || host.endsWith('.gemini.google.com')) {
      return 1.0;
    }
    return 0;
  }

  findComposer(): ComposerHandle | null {
    const el =
      (document.querySelector('rich-textarea div[contenteditable="true"]') as HTMLElement) ||
      (document.querySelector(
        'div[contenteditable="true"][aria-label*="prompt"]'
      ) as HTMLElement) ||
      (document.querySelector('div.ql-editor[contenteditable="true"]') as HTMLElement) ||
      (document.querySelector('textarea.textarea') as HTMLElement) ||
      (document.querySelector('div[contenteditable="true"]') as HTMLElement);

    if (!el) return null;

    const isContentEditable = el.getAttribute('contenteditable') === 'true';
    return {
      element: el,
      kind: isContentEditable ? 'contenteditable' : 'textarea',
      adapterId: this.id,
    };
  }

  readComposer(): string {
    const handle = this.findComposer();
    if (!handle) return '';
    if (handle.kind === 'textarea') {
      return (handle.element as HTMLTextAreaElement).value || '';
    }
    return handle.element.innerText || handle.element.textContent || '';
  }

  getCaretContext(): CaretContext | null {
    const handle = this.findComposer();
    if (!handle) return null;

    const fullText = this.readComposer();

    if (handle.kind === 'textarea') {
      const textarea = handle.element as HTMLTextAreaElement;
      const pos = textarea.selectionStart || 0;
      return {
        position: pos,
        textBefore: fullText.substring(0, pos),
        textAfter: fullText.substring(pos),
      };
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      return {
        position: fullText.length,
        textBefore: fullText,
        textAfter: '',
      };
    }

    try {
      const range = sel.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(handle.element);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      const textBefore = preCaretRange.toString();
      const pos = textBefore.length;

      return {
        position: pos,
        textBefore,
        textAfter: fullText.substring(pos),
      };
    } catch {
      return {
        position: fullText.length,
        textBefore: fullText,
        textAfter: '',
      };
    }
  }

  /**
   * Inserts text into the active Gemini composer, replacing an optional slash command
   * range and converting trailing newlines into paragraph breaks so the caret moves
   * to the next line.
   *
   * @param text - Text content to insert into the composer.
   * @param slashRange - Optional character range of the trigger command to replace.
   * @param _style - Optional visual style hint; ignored in Gemini's rich-textarea.
   */
  async insertText(
    text: string,
    slashRange?: TextRange,
    _style?: InsertedTextStyle
  ): Promise<void> {
    const handle = this.findComposer();
    if (!handle) return;

    handle.element.focus();

    if (handle.kind === 'textarea') {
      const textarea = handle.element as HTMLTextAreaElement;
      const start = slashRange ? slashRange.start : textarea.selectionStart || 0;
      const end = slashRange ? slashRange.end : textarea.selectionEnd || start;

      textarea.setRangeText(text, start, end, 'end');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    const trailingNewlines = text.match(/\n+$/)?.[0].length || 0;
    const contentToInsert = trailingNewlines > 0 ? text.slice(0, -trailingNewlines) : text;

    if (slashRange) {
      this.selectRange(handle.element, slashRange.start, slashRange.end);
    }

    // Attempt direct insertText (replaces selected range without destroying parent <p>)
    let success = document.execCommand('insertText', false, contentToInsert);

    if (!success && slashRange) {
      // Fallback: delete selection and try insertText again
      document.execCommand('delete');
      success = document.execCommand('insertText', false, contentToInsert);
    }

    if (!success) {
      // DOM fallback: ensure text is placed inside <p> to avoid breaking Gemini rich-textarea
      let p = handle.element.querySelector('p');
      if (!p) {
        p = document.createElement('p');
        handle.element.appendChild(p);
      }
      p.textContent = contentToInsert;

      const range = document.createRange();
      range.selectNodeContents(p);
      range.collapse(false);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    // Insert newlines using paragraph breaks (<p>) matching Gemini editor schema
    if (trailingNewlines > 0) {
      for (let i = 0; i < trailingNewlines; i++) {
        if (!document.execCommand('insertParagraph')) {
          document.execCommand('insertLineBreak');
        }
      }
    }

    handle.element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private selectRange(root: Node, start: number, end: number) {
    const range = document.createRange();
    let currentPos = 0;
    let startSet = false;
    const state = { lastTextNode: null as Node | null };

    function traverse(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        state.lastTextNode = node;
        const textLen = (node.textContent || '').length;
        if (!startSet && currentPos + textLen >= start) {
          range.setStart(node, Math.max(0, start - currentPos));
          startSet = true;
        }
        if (startSet && currentPos + textLen >= end) {
          range.setEnd(node, Math.min(textLen, end - currentPos));
          return true;
        }
        currentPos += textLen;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          if (traverse(node.childNodes[i])) return true;
        }
      }
      return false;
    }

    traverse(root);

    if (startSet && state.lastTextNode && range.collapsed) {
      const lastLen = (state.lastTextNode.textContent || '').length;
      range.setEnd(state.lastTextNode, lastLen);
    }

    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  observeComposer(callback: ComposerChangeCallback): DisposeFunction {
    let lastEl = this.findComposer()?.element;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = () => {
      const current = this.findComposer();
      const currentEl = current?.element;
      if (currentEl !== lastEl) {
        lastEl = currentEl;
        callback(current);
      }
    };

    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(check, 150);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }
}

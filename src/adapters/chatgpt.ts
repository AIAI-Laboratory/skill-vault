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

export class ChatGPTAdapter implements AIAdapter {
  readonly id = 'chatgpt';
  readonly name = 'ChatGPT';

  match(context: PageContext): number {
    const host = context.hostname.toLowerCase();
    if (host === 'chatgpt.com' || host === 'chat.openai.com' || host.endsWith('.chatgpt.com')) {
      return 1.0;
    }
    return 0;
  }

  findComposer(): ComposerHandle | null {
    // ChatGPT may render a hidden fallback textarea next to the ProseMirror editor, so
    // prefer a visible contenteditable and only fall back to visible textareas.
    const selectors = [
      '#prompt-textarea[contenteditable="true"]',
      'div.ProseMirror[contenteditable="true"]',
      'form [contenteditable="true"][data-placeholder]',
      '#prompt-textarea',
      'textarea[name="prompt-textarea"]',
      'textarea[data-id="root"]',
    ];
    const isVisible = (node: HTMLElement) => node.getClientRects().length > 0;
    let el: HTMLElement | null = null;
    for (const selector of selectors) {
      const match = [...document.querySelectorAll<HTMLElement>(selector)].find(isVisible);
      if (match) {
        el = match;
        break;
      }
    }

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

    // Contenteditable selection
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      return {
        position: fullText.length,
        textBefore: fullText,
        textAfter: '',
      };
    }

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
  }

  /**
   * Inserts text into the active ChatGPT composer, replacing an optional slash command
   * range and converting trailing newlines into paragraph breaks so ProseMirror moves
   * the caret to a new paragraph line.
   *
   * @param text - Text content to insert into the composer.
   * @param slashRange - Optional character range of the trigger command to replace.
   * @param _style - Optional inline formatting style hint; ignored in ProseMirror.
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

    // Contenteditable / ProseMirror
    const trailingNewlines = text.match(/\n+$/)?.[0].length || 0;
    const contentToInsert = trailingNewlines > 0 ? text.slice(0, -trailingNewlines) : text;

    if (slashRange) {
      this.selectRange(handle.element, slashRange.start, slashRange.end);
    }

    // Attempt direct insertText first so the parent <p> is preserved in ProseMirror
    let success = document.execCommand('insertText', false, contentToInsert);
    if (!success && slashRange) {
      document.execCommand('delete');
      success = document.execCommand('insertText', false, contentToInsert);
    }

    if (!success) {
      const inputEvent = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: contentToInsert,
      });
      handle.element.dispatchEvent(inputEvent);

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

    // Split into a new <p> block so ProseMirror creates a new line instead of a space
    if (trailingNewlines > 0) {
      for (let i = 0; i < trailingNewlines; i++) {
        if (!document.execCommand('insertParagraph')) {
          document.execCommand('insertLineBreak');
        }
      }
    }

    // Dispatch change event
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

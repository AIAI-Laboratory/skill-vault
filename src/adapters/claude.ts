import { PageContext } from '../domain/types';
import {
  AIAdapter,
  ComposerHandle,
  CaretContext,
  TextRange,
  ComposerChangeCallback,
  DisposeFunction,
} from './types';

export class ClaudeAdapter implements AIAdapter {
  readonly id = 'claude';
  readonly name = 'Claude';

  match(context: PageContext): number {
    const host = context.hostname.toLowerCase();
    if (host === 'claude.ai' || host.endsWith('.claude.ai')) {
      return 1.0;
    }
    return 0;
  }

  findComposer(): ComposerHandle | null {
    const el =
      (document.querySelector('div.ProseMirror[contenteditable="true"]') as HTMLElement) ||
      (document.querySelector(
        'div[contenteditable="true"][aria-label*="Claude"]'
      ) as HTMLElement) ||
      (document.querySelector('fieldset div[contenteditable="true"]') as HTMLElement) ||
      (document.querySelector('div[contenteditable="true"]') as HTMLElement);

    if (!el) return null;

    return {
      element: el,
      kind: 'contenteditable',
      adapterId: this.id,
    };
  }

  readComposer(): string {
    const handle = this.findComposer();
    if (!handle) return '';
    return handle.element.innerText || handle.element.textContent || '';
  }

  getCaretContext(): CaretContext | null {
    const handle = this.findComposer();
    if (!handle) return null;

    const fullText = this.readComposer();
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

  async insertText(text: string, slashRange?: TextRange): Promise<void> {
    const handle = this.findComposer();
    if (!handle) return;

    handle.element.focus();

    if (slashRange) {
      this.selectRange(handle.element, slashRange.start, slashRange.end);
      document.execCommand('delete');
    }

    // Claude ProseMirror responds reliably to document.execCommand('insertText')
    const success = document.execCommand('insertText', false, text);
    if (!success) {
      const inputEvt = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      });
      handle.element.dispatchEvent(inputEvt);
      handle.element.textContent = text;
      handle.element.dispatchEvent(new Event('input', { bubbles: true }));
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
    let timer: any = null;

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

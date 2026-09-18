import { PageContext } from '../domain/types';
import {
  AIAdapter,
  ComposerHandle,
  CaretContext,
  TextRange,
  ComposerChangeCallback,
  DisposeFunction,
} from './types';

export class GenericAdapter implements AIAdapter {
  readonly id = 'generic';
  readonly name = 'Generic AI';

  match(_context: PageContext): number {
    // Low baseline match if any active or visible textarea exists
    const hasInput = document.querySelector('textarea, [contenteditable="true"]');
    return hasInput ? 0.3 : 0;
  }

  findComposer(): ComposerHandle | null {
    // Check currently focused element
    const active = document.activeElement as HTMLElement;
    if (
      active &&
      (active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true')
    ) {
      return {
        element: active,
        kind: active.tagName === 'TEXTAREA' ? 'textarea' : 'contenteditable',
        adapterId: this.id,
      };
    }

    // Check visible textareas or contenteditables
    const el = document.querySelector('textarea, [contenteditable="true"]') as HTMLElement;
    if (!el) return null;

    return {
      element: el,
      kind: el.tagName === 'TEXTAREA' ? 'textarea' : 'contenteditable',
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

  async insertText(text: string, slashRange?: TextRange): Promise<void> {
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

    if (slashRange) {
      this.selectRange(handle.element, slashRange.start, slashRange.end);
      document.execCommand('delete');
    }

    // Try execCommand first
    const success = document.execCommand('insertText', false, text);
    if (!success) {
      handle.element.textContent = text;
      handle.element.dispatchEvent(new Event('input', { bubbles: true }));
    }
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
    document.addEventListener('focusin', check);

    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', check);
      clearTimeout(timer);
    };
  }
}

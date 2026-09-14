import { PageContext } from '../domain/types';

export interface TextRange {
  start: number;
  end: number;
}

export interface ComposerHandle {
  element: HTMLElement;
  kind: 'textarea' | 'contenteditable' | 'prosemirror' | 'custom';
  adapterId: string;
}

export interface CaretContext {
  position: number;
  textBefore: string;
  textAfter: string;
}

export type ComposerChangeCallback = (composer: ComposerHandle | null) => void;
export type DisposeFunction = () => void;

export interface AIAdapter {
  readonly id: string;
  readonly name: string;

  /**
   * Returns a confidence score from 0 (no match) to 1.0 (certain match).
   */
  match(context: PageContext): number;

  /**
   * Finds the active or primary chat composer element on the page.
   */
  findComposer(): ComposerHandle | null;

  /**
   * Reads current text from the composer.
   */
  readComposer(): string;

  /**
   * Replaces slashRange (or inserts at caret) with rendered prompt text,
   * triggering all necessary DOM input/change events without auto-submitting.
   */
  insertText(text: string, slashRange?: TextRange): Promise<void>;

  /**
   * Returns caret context if available.
   */
  getCaretContext?(): CaretContext | null;

  /**
   * Subscribes to composer lifecycle changes (e.g. DOM remounting / route navigation).
   */
  observeComposer(callback: ComposerChangeCallback): DisposeFunction;
}

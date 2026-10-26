export type InsertedTextStyle = 'highlight' | 'plain';

/**
 * Applies or clears inline formatting on the current editor selection, then collapses
 * the selection to the end of the formatted range.
 *
 * @param style - Visual style to apply to the selected inserted text.
 */
export function formatInsertedText(style: InsertedTextStyle): void {
  if (style === 'highlight') {
    if (!document.execCommand('hiliteColor', false, '#ffe08a'))
      document.execCommand('backColor', false, '#ffe08a');
    document.execCommand('foreColor', false, '#291d0e');
    document.execCommand('bold');
  } else {
    document.execCommand('removeFormat');
  }

  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);

  if (style === 'highlight') {
    document.execCommand('removeFormat');
  }
}

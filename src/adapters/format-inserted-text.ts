export type InsertedTextStyle = 'highlight' | 'plain';

export function formatInsertedText(style: InsertedTextStyle) {
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
}

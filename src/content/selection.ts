/**
 * Runs inside the selected frame via chrome.scripting.executeScript.
 * Keep this function self-contained: Chrome serializes it without module scope.
 */
export function readPageSelection(): string {
  const activeElement = document.activeElement;
  if (
    (activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLInputElement) &&
    activeElement.selectionStart !== null &&
    activeElement.selectionEnd !== null
  ) {
    return activeElement.value.slice(activeElement.selectionStart, activeElement.selectionEnd);
  }

  const selection = window.getSelection();
  if (!selection) return '';
  const renderedText = selection.toString();

  // GitHub renders source lines as individual elements. Native selection text
  // can omit their empty rows, so join only the selected portions of those rows.
  if (selection.rangeCount === 1) {
    const range = selection.getRangeAt(0);
    const ancestor = range.commonAncestorContainer;
    const root = ancestor instanceof Element ? ancestor : ancestor.parentElement;
    const lineSelector = '.react-file-line, .blob-code-inner';
    const containingLine = root?.closest(lineSelector);
    const lines = containingLine
      ? [containingLine]
      : Array.from(root?.querySelectorAll(lineSelector) || []);
    const selectedLines: string[] = [];
    for (const line of lines) {
      if (!range.intersectsNode(line)) continue;
      const selectedPart = document.createRange();
      selectedPart.selectNodeContents(line);
      if (range.compareBoundaryPoints(Range.START_TO_START, selectedPart) > 0) {
        selectedPart.setStart(range.startContainer, range.startOffset);
      }
      if (range.compareBoundaryPoints(Range.END_TO_END, selectedPart) < 0) {
        selectedPart.setEnd(range.endContainer, range.endOffset);
      }
      selectedLines.push(selectedPart.toString().replace(/\r?\n$/, ''));
    }
    if (selectedLines.length) {
      const codeText = selectedLines.join('\n');
      const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
      if (normalize(codeText) === normalize(renderedText)) return codeText;
    }
  }

  return renderedText;
}

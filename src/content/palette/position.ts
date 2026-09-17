interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
}

export function getPalettePosition(
  anchor: AnchorRect,
  viewport: { width: number; height: number },
  contentHeight: number
) {
  const margin = 12;
  const gap = 10;
  const width = Math.max(0, Math.min(380, viewport.width - margin * 2));
  const above = Math.max(0, anchor.top - gap - margin);
  const below = Math.max(0, viewport.height - anchor.bottom - gap - margin);
  const desiredHeight = Math.min(contentHeight, 420);
  const placeAbove = above >= desiredHeight || above >= below;
  const maxHeight = Math.min(420, placeAbove ? above : below);
  const height = Math.min(desiredHeight, maxHeight);
  const top = placeAbove ? anchor.top - gap - height : anchor.bottom + gap;

  return {
    width,
    maxHeight,
    top: Math.max(margin, Math.min(top, viewport.height - height - margin)),
    left: Math.max(margin, Math.min(anchor.left, viewport.width - width - margin)),
  };
}

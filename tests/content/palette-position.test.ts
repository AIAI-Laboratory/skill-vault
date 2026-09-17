import { describe, expect, it } from 'vitest';
import { getPalettePosition } from '../../src/content/palette/position';

describe('palette positioning', () => {
  it('uses the measured height above the composer', () => {
    expect(
      getPalettePosition({ top: 600, bottom: 660, left: 40 }, { width: 1000, height: 800 }, 280)
    ).toEqual({ top: 310, left: 40, width: 380, maxHeight: 420 });
  });
  it('opens below the composer when it is near the top', () => {
    expect(
      getPalettePosition({ top: 30, bottom: 90, left: 40 }, { width: 1000, height: 800 }, 300).top
    ).toBe(100);
  });
  it('fits a narrow viewport and clamps the right edge', () => {
    const result = getPalettePosition(
      { top: 450, bottom: 500, left: 200 },
      { width: 320, height: 600 },
      420
    );
    expect(result.left).toBe(12);
    expect(result.width).toBe(296);
    expect(result.top).toBeGreaterThanOrEqual(12);
    expect(result.top + result.maxHeight).toBeLessThan(450);
  });
  it('limits the height to available space without covering the composer', () => {
    const result = getPalettePosition(
      { top: 200, bottom: 260, left: 0 },
      { width: 400, height: 400 },
      420
    );
    expect(result.maxHeight).toBe(178);
    expect(result.top).toBe(12);
  });
});

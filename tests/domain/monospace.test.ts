import { describe, it, expect } from 'vitest';
import { toMathematicalMonospace } from '../../src/domain/monospace';

describe('toMathematicalMonospace', () => {
  it('converts lowercase letters to Unicode Mathematical Monospace Small', () => {
    expect(toMathematicalMonospace('a')).toBe('𝚊');
    expect(toMathematicalMonospace('z')).toBe('𝚣');
    expect(toMathematicalMonospace('review')).toBe('𝚛𝚎𝚟𝚒𝚎𝚠');
  });

  it('converts uppercase letters to Mathematical Monospace Small by default', () => {
    expect(toMathematicalMonospace('A')).toBe('𝚊');
    expect(toMathematicalMonospace('Z')).toBe('𝚣');
    expect(toMathematicalMonospace('Code')).toBe('𝚌𝚘𝚍𝚎');
  });

  it('converts uppercase letters to Capital Monospace when preserveCase is true', () => {
    expect(toMathematicalMonospace('Code', true)).toBe('𝙲𝚘𝚍𝚎');
  });

  it('converts digits 0-9 to Mathematical Monospace Digits', () => {
    expect(toMathematicalMonospace('0123456789')).toBe('𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿');
    expect(toMathematicalMonospace('python3')).toBe('𝚙𝚢𝚝𝚑𝚘𝚗𝟹');
  });

  it('preserves non-ASCII text and existing monospace characters', () => {
    expect(toMathematicalMonospace('Đọc Code 2 𝚊', true)).toBe('Đọ𝚌 𝙲𝚘𝚍𝚎 𝟸 𝚊');
    expect(toMathematicalMonospace('')).toBe('');
  });

  it('preserves symbols, punctuation, and emojis as-is', () => {
    expect(toMathematicalMonospace('/review')).toBe('/𝚛𝚎𝚟𝚒𝚎𝚠');
    expect(toMathematicalMonospace('🏷️ /code-review')).toBe('🏷️ /𝚌𝚘𝚍𝚎-𝚛𝚎𝚟𝚒𝚎𝚠');
  });
});

/**
 * Converts alphanumeric characters to Unicode Mathematical Monospace Small.
 * - Lowercase a-z -> U+1D68A..U+1D6A3 (Mathematical Monospace Small a-z)
 * - Uppercase A-Z -> U+1D68A..U+1D6A3 (Mathematical Monospace Small a-z by default,
 *   or U+1D670..U+1D689 if preserveCase is true)
 * - Digits 0-9 -> U+1D7F6..U+1D7FF (Mathematical Monospace Digits 0-9)
 * - Other characters (punctuation, symbols, spaces) are preserved as-is.
 */
export function toMathematicalMonospace(text: string, preserveCase = false): string {
  return text.replace(/[a-zA-Z0-9]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 97 && code <= 122) {
      // a-z -> Mathematical Monospace Small (U+1D68A..U+1D6A3)
      return String.fromCodePoint(0x1d68a + (code - 97));
    }
    if (code >= 65 && code <= 90) {
      if (preserveCase) {
        // A-Z -> Mathematical Monospace Capital (U+1D670..U+1D689)
        return String.fromCodePoint(0x1d670 + (code - 65));
      }
      // A-Z -> Mathematical Monospace Small (U+1D68A..U+1D6A3)
      return String.fromCodePoint(0x1d68a + (code - 65));
    }
    if (code >= 48 && code <= 57) {
      // 0-9 -> Mathematical Monospace Digits (U+1D7F6..U+1D7FF)
      return String.fromCodePoint(0x1d7f6 + (code - 48));
    }
    return ch;
  });
}

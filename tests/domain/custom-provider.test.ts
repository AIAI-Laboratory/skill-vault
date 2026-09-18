import { describe, expect, it } from 'vitest';
import {
  normalizeProviderUrl,
  normalizeProviderUrls,
  providerMatchPattern,
} from '../../src/domain/custom-provider';

describe('custom provider URLs', () => {
  it('normalizes a pasted chat URL to its origin', () => {
    expect(normalizeProviderUrl('  https://CHAT.example.com/thread?id=1#chat  ')).toBe(
      'https://chat.example.com'
    );
    expect(normalizeProviderUrl('http://localhost:3000/chat')).toBe('http://localhost:3000');
    expect(providerMatchPattern('http://localhost:3000')).toBe('http://localhost/*');
  });
  it.each([
    'example.com',
    'javascript:alert(1)',
    'file:///tmp/chat',
    'https://user:pass@example.com',
    'https://*.example.com',
    'https://chatgpt.com/chat',
  ])('rejects unsupported URL %s', (url) => {
    expect(() => normalizeProviderUrl(url)).toThrow();
  });
  it('rejects duplicates after normalization', () => {
    expect(() => normalizeProviderUrls(['https://example.com/a', 'https://EXAMPLE.com/b'])).toThrow(
      'already added'
    );
  });
});

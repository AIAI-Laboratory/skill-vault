import { describe, it, expect } from 'vitest';
import { fillUserInput, hasUserInputSlot } from '../../src/domain/variable';

describe('user_input slot', () => {
  it('detects single and double brace slots', () => {
    expect(hasUserInputSlot('Explain {user_input} simply')).toBe(true);
    expect(hasUserInputSlot('Explain {{ user_input }} simply')).toBe(true);
    expect(hasUserInputSlot('Explain {{text}} simply')).toBe(false);
    // Stateless across calls (global regex lastIndex must not leak).
    expect(hasUserInputSlot('{user_input}')).toBe(true);
    expect(hasUserInputSlot('{user_input}')).toBe(true);
  });

  it('fills every slot and keeps other variables rendering', () => {
    const out = fillUserInput(
      'Topic: {user_input}\nAgain: {{user_input}}\nOn {{provider}}',
      'I want to learn about AI',
      { provider: 'ChatGPT' }
    );
    expect(out).toBe(
      'Topic: I want to learn about AI\nAgain: I want to learn about AI\nOn ChatGPT'
    );
  });

  it('does not treat braces in the user text as variables', () => {
    expect(fillUserInput('Fix: {user_input}', 'const a = {{b}}; $&')).toBe(
      'Fix: const a = {{b}}; $&'
    );
  });
});

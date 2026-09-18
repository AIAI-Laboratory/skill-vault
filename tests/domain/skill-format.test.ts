import { describe, expect, it } from 'vitest';
import { resolveSkillFormat, type SkillFormatDraft } from '../../src/domain/skill-format';
import { createSkillEntity } from '../../src/domain/skill';

const draft: SkillFormatDraft = {
  name: '',
  description: '',
  shortcut: '',
  content: 'Review code\nKeep {{selected_text}} unchanged.',
  tags: ['personal'],
};
const response = {
  promptAction: 'improve',
  name: 'Review',
  description: 'Review code safely.',
  shortcut: 'review',
  content: '# Review code\n\n- Keep {{selected_text}} unchanged.',
  tags: ['Coding', 'coding', 'personal'],
};
const existing = createSkillEntity({
  ...draft,
  name: 'Review',
  shortcut: 'review',
  tags: ['coding'],
  favorite: false,
  variables: [],
});

describe('AI format safeguards', () => {
  it('accepts presentation changes, reuses tags and resolves conflicting generated metadata', () => {
    const result = resolveSkillFormat(draft, response, [existing]);
    expect(result).toMatchObject({
      name: 'Review (2)',
      shortcut: 'review-2',
      tags: ['personal', 'coding'],
      content: response.content,
    });
    expect(draft.content).toBe('Review code\nKeep {{selected_text}} unchanged.');
  });
  it('accepts rephrasing in the original language without requiring the original words', () => {
    const content = 'giải thích code này dễ hiểu giúp mình';
    const improved = 'Giải thích đoạn code này một cách dễ hiểu giúp mình.';
    expect(
      resolveSkillFormat({ ...draft, content }, { ...response, content: improved }, []).content
    ).toBe(improved);
  });
  it.each([
    'Explain this clearly. '.repeat(80),
    'Role\nContext\nInput\nOutput\nConstraints',
    '- Keep facts\n- Use Vietnamese\n- Return JSON',
    'Run exactly:\n```python\nprint(1)\n```',
  ])('allows wording improvements for long or structured prompts: %s', (content) => {
    const improved = content
      .replaceAll('Explain this clearly.', 'Explain this in clear terms.')
      .replace('Context', 'Context:')
      .replace('Use Vietnamese', 'Write in Vietnamese')
      .replace('Run exactly:', 'Run this exact code:');
    expect(
      resolveSkillFormat({ ...draft, content }, { ...response, content: improved }, []).content
    ).toBe(improved);
  });
  it('preserves short but detailed prompts classified by Gemini, even if its content field differs', () => {
    const content = 'Dịch sang tiếng Việt, chỉ trả về bản dịch.';
    expect(
      resolveSkillFormat(
        { ...draft, content },
        { ...response, promptAction: 'preserve', content: 'Extra instructions' },
        []
      ).content
    ).toBe(content);
  });
  it('rejects newly added variables and URLs even in small clarifications', () => {
    for (const addition of ['Use {{new_input}}.', 'See https://example.com.']) {
      expect(() =>
        resolveSkillFormat(draft, { ...response, content: draft.content + '\n' + addition }, [])
      ).toThrow('changed code, URLs, or variables');
    }
  });
  it('preserves user metadata and excludes the skill being edited from collisions', () => {
    const entered = {
      ...draft,
      id: existing.id,
      name: 'My review',
      description: 'My description',
      shortcut: 'review',
    };
    expect(resolveSkillFormat(entered, response, [existing])).toMatchObject({
      name: entered.name,
      description: entered.description,
      shortcut: entered.shortcut,
    });
    expect(() => resolveSkillFormat({ ...entered, id: undefined }, response, [existing])).toThrow(
      'already used'
    );
  });
  it('handles reserved shortcuts, invalid characters, and 32-character suffixes', () => {
    expect(resolveSkillFormat(draft, { ...response, shortcut: '/settings' }, []).shortcut).toBe(
      'settings-2'
    );
    const long = 'a'.repeat(32);
    expect(
      resolveSkillFormat(draft, { ...response, shortcut: long }, [{ ...existing, shortcut: long }])
        .shortcut
    ).toBe('a'.repeat(30) + '-2');
  });
  it.each([
    ['{{ selected_text }}', '{{selected_text}}'],
    ['{{ selected_text }}', '{{page_url}}'],
    ['https://example.com/docs', 'https://example.com/other'],
    ['    run()', 'run()'],
    ['`a  b`', '`a b`'],
    ['`a  b`', ''],
  ])('rejects changes to protected content: %s → %s', (original, replacement) => {
    const content =
      'Run this\n```python\nif ok:\n    run()\n```\nUse {{ selected_text }} and `a  b`. See https://example.com/docs';
    expect(() =>
      resolveSkillFormat(
        { ...draft, content },
        { ...response, content: content.replace(original, replacement) },
        []
      )
    ).toThrow('changed code, URLs, or variables');
  });
  it('accepts revised prose around unchanged code, variables and URLs', () => {
    const content =
      'Run this\n```python\nif ok:\n    run()\n```\nUse {{ selected_text }} and `a  b`. See https://example.com/docs';
    const improved = content.replace('Run this', 'Execute the following code');
    expect(
      resolveSkillFormat({ ...draft, content }, { ...response, content: improved }, []).content
    ).toBe(improved);
  });
  it('retains the exact original when preservation is requested', () => {
    const content = '  Keep this wording.\n\n' + 'Detailed requirement. '.repeat(80);
    expect(
      resolveSkillFormat(
        { ...draft, content },
        { ...response, promptAction: 'preserve', content: 'Unexpected rewrite' },
        []
      ).content
    ).toBe(content);
  });
  it.each([
    null,
    {},
    { ...response, tags: 'coding' },
    { ...response, content: '' },
    { ...response, content: '   ' },
    { ...response, promptAction: 'rewrite' },
  ])('rejects malformed responses', (value) => {
    expect(() => resolveSkillFormat(draft, value, [])).toThrow();
  });
});

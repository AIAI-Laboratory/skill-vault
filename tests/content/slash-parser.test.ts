import { describe, it, expect } from 'vitest';
import { parseSlashCommand } from '../../src/content/slash/parser';

describe('Slash Command Parser', () => {
  it('detects /skill at the beginning of the text', () => {
    const res = parseSlashCommand('/skill');
    expect(res.type).toBe('skill_palette');
    expect(res.query).toBe('');
    expect(res.range).toEqual({ start: 0, end: 6 });
  });

  it('detects /skill with query at the beginning of the text', () => {
    const res = parseSlashCommand('/skill review code');
    expect(res.type).toBe('skill_palette');
    expect(res.query).toBe('review code');
    expect(res.range).toEqual({ start: 0, end: 18 });
  });

  it('detects /skill following a newline', () => {
    const text = 'Here is line 1\n/skill explain';
    const res = parseSlashCommand(text);
    expect(res.type).toBe('skill_palette');
    expect(res.query).toBe('explain');
    expect(res.range.start).toBe(text.indexOf('/skill'));
    expect(res.range.end).toBe(text.length);
  });

  it('rejects mid-sentence /skill to avoid triggering on URLs or plain text', () => {
    expect(parseSlashCommand('visit https://example.com/skill').type).toBe('none');
    expect(parseSlashCommand('hello /skill').type).toBe('none');
    expect(parseSlashCommand('check /skill out').type).toBe('none');
  });

  it('handles empty input gracefully', () => {
    expect(parseSlashCommand('').type).toBe('none');
  });
});

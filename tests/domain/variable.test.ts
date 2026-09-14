import { describe, it, expect } from 'vitest';
import {
  extractVariables,
  resolveAutomaticVariables,
  renderPromptTemplate,
} from '../../src/domain/variable';

describe('Variable Resolution Pipeline', () => {
  it('extracts variable names from prompt content', () => {
    const text = 'Translate {{text}} to {{language}} on {{current_date}}.';
    const vars = extractVariables(text);
    expect(vars).toEqual(['text', 'language', 'current_date']);
  });

  it('resolves automatic variables', () => {
    const text = 'Date: {{current_date}}, Page: {{page_title}}, Selected: {{selected_text}}';
    const resolved = resolveAutomaticVariables(text, {
      title: 'ChatGPT - New Chat',
      url: 'https://chatgpt.com',
      selectedText: 'const x = 1;',
    });

    const today = new Date().toISOString().split('T')[0];
    expect(resolved).toContain(`Date: ${today}`);
    expect(resolved).toContain('Page: ChatGPT - New Chat');
    expect(resolved).toContain('Selected: const x = 1;');
  });

  it('renders prompt with user supplied variables and clears unprovided variables', () => {
    const template = 'Hello {{name}}, your role is {{role}}. Extra: {{unprovided}}';
    const result = renderPromptTemplate(template, {
      name: 'Alice',
      role: 'Architect',
    });

    expect(result).toBe('Hello Alice, your role is Architect. Extra: ');
  });
});

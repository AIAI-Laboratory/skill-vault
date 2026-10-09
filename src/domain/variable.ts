import { PageContext } from './types';

const VARIABLE_REGEX = /\{\{([a-zA-Z0-9_]+)\}\}/g;

// Matches `{user_input}` or `{{user_input}}` (whitespace inside braces allowed).
const USER_INPUT_REGEX = /\{\{\s*user_input\s*\}\}|\{\s*user_input\s*\}/g;
const USER_INPUT_SENTINEL = '\u0000sv-user-input\u0000';

/**
 * Whether a prompt template has a `{user_input}` slot for selected text.
 */
export function hasUserInputSlot(content: string): boolean {
  return new RegExp(USER_INPUT_REGEX.source).test(content);
}

/**
 * Renders a template and places `input` in every `{user_input}` slot.
 */
export function fillUserInput(
  content: string,
  input: string,
  context?: Partial<PageContext> & { provider?: string }
): string {
  const tokenized = content.replace(USER_INPUT_REGEX, USER_INPUT_SENTINEL);
  return renderPromptTemplate(tokenized, {}, context).split(USER_INPUT_SENTINEL).join(input);
}

/**
 * Extracts all {{variable_name}} tokens from a skill prompt template.
 */
export function extractVariables(content: string): string[] {
  const matches = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = VARIABLE_REGEX.exec(content)) !== null) {
    if (match[1]) {
      matches.add(match[1]);
    }
  }

  return Array.from(matches);
}

/**
 * Resolves automatic built-in variables like {{current_date}}, {{selected_text}}, {{page_title}}, etc.
 */
export function resolveAutomaticVariables(
  content: string,
  context?: Partial<PageContext> & { provider?: string }
): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const builtInMap: Record<string, string> = {
    current_date: dateStr,
    current_time: now.toLocaleTimeString(),
    page_title: context?.title || '',
    page_url: context?.url || '',
    selected_text: context?.selectedText || '',
    provider: context?.provider || 'AI',
  };

  return content.replace(VARIABLE_REGEX, (fullMatch, varName: string) => {
    if (varName in builtInMap) {
      return builtInMap[varName];
    }
    return fullMatch;
  });
}

/**
 * Replaces variables in content with provided values.
 * If variable is undefined and missing, it is replaced with empty string or left as is.
 */
export function renderPromptTemplate(
  content: string,
  variables: Record<string, string>,
  context?: Partial<PageContext> & { provider?: string }
): string {
  const withAutomatic = resolveAutomaticVariables(content, context);

  return withAutomatic.replace(VARIABLE_REGEX, (_fullMatch, varName: string) => {
    if (varName in variables) {
      return variables[varName];
    }
    // If not supplied in variables, replace with empty string
    return '';
  });
}

import { TextRange } from '../../adapters/types';

export interface SlashParseResult {
  type: 'none' | 'skill_palette';
  query: string;
  range: TextRange;
}

/**
 * Parses text before caret to detect slash command.
 * Slash command must start either at the very beginning of the composer (index 0)
 * or immediately following a newline character (\n).
 */
export function parseSlashCommand(textBeforeCaret: string): SlashParseResult {
  if (!textBeforeCaret || !textBeforeCaret.includes('/skill')) {
    return { type: 'none', query: '', range: { start: 0, end: 0 } };
  }

  // Regex matches /skill followed by optional spaces and query at start of line or string
  // Matches:
  // ^/skill(.*)$
  // \n/skill(.*)$
  const match = /(?:^|\n)(\/skill(?:\s+([^\n]*))?)$/.exec(textBeforeCaret);
  if (!match) {
    return { type: 'none', query: '', range: { start: 0, end: 0 } };
  }

  const matchedCommand = match[1]; // e.g. "/skill" or "/skill review"
  const rawQuery = match[2] || ''; // e.g. "review" or ""
  const start = textBeforeCaret.length - matchedCommand.length;
  const end = textBeforeCaret.length;

  return {
    type: 'skill_palette',
    query: rawQuery.trim(),
    range: { start, end },
  };
}

import { isValidShortcut, RESERVED_SHORTCUTS } from './skill';
import type { Skill } from './types';

export interface SkillFormatDraft {
  id?: string;
  name: string;
  description: string;
  shortcut: string;
  content: string;
  tags: string[];
}

function protectedParts(text: string): string[] {
  return (
    text.match(
      /^[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]{0,3}\1[ \t]*$|`+[^`\n]*`+|\{\{[^{}]*\}\}|https?:\/\/[^\s<>]+/gm
    ) || []
  );
}

export function resolveSkillFormat(
  draft: SkillFormatDraft,
  raw: unknown,
  skills: Skill[]
): SkillFormatDraft {
  if (!raw || typeof raw !== 'object')
    throw new Error('Gemini returned an invalid format. Try again.');
  const result = raw as Record<string, unknown>;
  if (
    !['name', 'description', 'shortcut', 'content'].every(
      (key) => typeof result[key] === 'string'
    ) ||
    !['preserve', 'improve'].includes(result.promptAction as string) ||
    !Array.isArray(result.tags) ||
    !result.tags.every((tag) => typeof tag === 'string')
  )
    throw new Error('Gemini returned incomplete fields. Try again.');
  // Meaning is governed by the model instructions and reviewed in the preview.
  // These checks only enforce literal preservation of code, URLs and variables.
  let content = draft.content;
  if (result.promptAction === 'improve') {
    const proposed = result.content as string;
    if (
      !proposed.trim() ||
      JSON.stringify(protectedParts(draft.content)) !== JSON.stringify(protectedParts(proposed))
    ) {
      throw new Error(
        'The AI returned an empty prompt or changed code, URLs, or variables. Your draft is unchanged. Try again.'
      );
    }
    content = proposed;
  }
  const others = skills.filter((skill) => skill.id !== draft.id);
  const usedShortcuts = new Set([
    ...RESERVED_SHORTCUTS,
    ...others.map((skill) => skill.shortcut?.toLowerCase()).filter(Boolean),
  ]);
  let shortcut = draft.shortcut;
  if (!shortcut.trim()) {
    const base =
      (result.shortcut as string)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .replace(/^-+/, '')
        .slice(0, 32) || 'prompt';
    shortcut = base;
    for (let suffix = 2; usedShortcuts.has(shortcut); suffix++) {
      const ending = `-${suffix}`;
      shortcut = `${base.slice(0, 32 - ending.length)}${ending}`;
    }
  }
  if (!isValidShortcut(shortcut).valid || usedShortcuts.has(shortcut.trim().toLowerCase())) {
    throw new Error(
      'Your shortcut is invalid or already used. Update it or leave it empty for an AI suggestion.'
    );
  }
  let name = draft.name;
  if (!name.trim()) {
    const base = (result.name as string).trim() || 'Untitled skill';
    const usedNames = new Set(others.map((skill) => skill.name.trim().toLowerCase()));
    name = base;
    for (let suffix = 2; usedNames.has(name.toLowerCase()); suffix++) name = `${base} (${suffix})`;
  }
  const canonicalTags = new Map(
    skills.flatMap((skill) => skill.tags).map((tag) => [tag.trim().toLowerCase(), tag])
  );
  const tags = [
    ...new Set(
      [...draft.tags, ...(result.tags as string[])]
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    ),
  ].map((tag) => canonicalTags.get(tag) || tag);
  return {
    ...draft,
    name,
    description: draft.description.trim()
      ? draft.description
      : (result.description as string).trim(),
    shortcut,
    content,
    tags,
  };
}

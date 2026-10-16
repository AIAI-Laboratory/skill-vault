import type { Skill } from './types';

export const DEFAULT_COLLECTIONS = ['Coding', 'Writing', 'Research', 'Productivity'];
export const SKILL_SORTS = {
  newest: 'Newest first',
  name: 'Name A–Z',
  usage: 'Most used',
  recent: 'Recently used',
  updated: 'Recently edited',
} as const;
export type SkillSort = keyof typeof SKILL_SORTS;

// Each term narrows the result; #tags match exactly, text and /commands match partially.
export function matchesSkillSearch(skill: Skill, query: string): boolean {
  const tags = skill.tags.map((tag) => tag.toLowerCase());
  const text = [skill.name, skill.description ?? '', skill.shortcut ?? '', ...tags]
    .join('\n')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    .every((term) =>
      term.startsWith('#') ? tags.includes(term.slice(1)) : text.includes(term.replace(/^\//, ''))
    );
}

export function normalizeCollection(name: string): string {
  const trimmed = name.trim();
  return (
    DEFAULT_COLLECTIONS.find((item) => item.toLowerCase() === trimmed.toLowerCase()) ?? trimmed
  );
}

// Older vaults have only tags; explicit empty collections remain unassigned.
export function getSkillCollection(skill: Pick<Skill, 'collection' | 'tags'>): string {
  if (skill.collection !== undefined) return normalizeCollection(skill.collection);
  return (
    DEFAULT_COLLECTIONS.find((name) =>
      skill.tags.some((tag) => tag.toLowerCase() === name.toLowerCase())
    ) ?? ''
  );
}

const timestamp = (value?: string) => Date.parse(value ?? '') || 0;

export function sortSkills(skills: Skill[], sort: SkillSort): Skill[] {
  return [...skills].sort((a, b) => {
    const pinned = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinned) return pinned;
    switch (sort) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'usage':
        return b.usage.count - a.usage.count;
      case 'recent':
        return timestamp(b.usage.lastUsedAt) - timestamp(a.usage.lastUsedAt);
      case 'updated':
        return timestamp(b.updatedAt) - timestamp(a.updatedAt);
      default:
        return timestamp(b.createdAt) - timestamp(a.createdAt);
    }
  });
}

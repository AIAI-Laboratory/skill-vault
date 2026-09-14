import { Skill, CreateSkillInput } from './types';

export const CURRENT_SCHEMA_VERSION = 1;

export const RESERVED_SHORTCUTS = new Set([
  'skill',
  'skills',
  'help',
  'settings',
  'vault',
]);

const SHORTCUT_REGEX = /^[a-z0-9][a-z0-9-]{0,31}$/;

/**
 * Validates a skill shortcut string.
 * Must match ^[a-z0-9][a-z0-9-]{0,31}$ and not be in RESERVED_SHORTCUTS.
 */
export function isValidShortcut(shortcut?: string): { valid: boolean; error?: string } {
  if (!shortcut || shortcut.trim() === '') {
    return { valid: true };
  }

  const normalized = shortcut.trim().toLowerCase();

  if (RESERVED_SHORTCUTS.has(normalized)) {
    return { valid: false, error: `'${normalized}' is a reserved system command` };
  }

  if (!SHORTCUT_REGEX.test(normalized)) {
    return {
      valid: false,
      error: 'Shortcut must be 1-32 chars, lowercase letters, numbers, or hyphens, starting with a letter/number',
    };
  }

  return { valid: true };
}

/**
 * Generates a unique, timestamp-ordered ID with prefix sk_
 */
export function generateSkillId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);
  return `sk_${timestamp}${randomPart}`.toLowerCase();
}

/**
 * Validates input for creating or updating a skill.
 */
export function validateSkill(input: Partial<CreateSkillInput>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.name || input.name.trim() === '') {
    errors.push('Skill name is required');
  }

  if (!input.content || input.content.trim() === '') {
    errors.push('Skill prompt content is required');
  }

  if (input.shortcut) {
    const shortcutCheck = isValidShortcut(input.shortcut);
    if (!shortcutCheck.valid && shortcutCheck.error) {
      errors.push(shortcutCheck.error);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a complete Skill object from CreateSkillInput with defaults.
 */
export function createSkillEntity(input: CreateSkillInput): Skill {
  const now = new Date().toISOString();
  return {
    id: input.id || generateSkillId(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: input.name.trim(),
    description: input.description?.trim() || '',
    shortcut: input.shortcut ? input.shortcut.trim().toLowerCase() : undefined,
    content: input.content,
    tags: Array.isArray(input.tags)
      ? input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
      : [],
    favorite: Boolean(input.favorite),
    variables: input.variables || [],
    providers: input.providers || [],
    createdAt: now,
    updatedAt: now,
    usage: {
      count: 0,
    },
  };
}

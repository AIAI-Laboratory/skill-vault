import { describe, it, expect } from 'vitest';
import { isValidShortcut, validateSkill, createSkillEntity } from '../../src/domain/skill';

describe('Skill Domain Logic', () => {
  describe('isValidShortcut', () => {
    it('accepts valid alphanumeric shortcuts with hyphens', () => {
      expect(isValidShortcut('review').valid).toBe(true);
      expect(isValidShortcut('code-review').valid).toBe(true);
      expect(isValidShortcut('translate2').valid).toBe(true);
      expect(isValidShortcut('a').valid).toBe(true);
    });

    it('rejects reserved shortcuts', () => {
      expect(isValidShortcut('skill').valid).toBe(false);
      expect(isValidShortcut('skills').valid).toBe(false);
      expect(isValidShortcut('help').valid).toBe(false);
      expect(isValidShortcut('settings').valid).toBe(false);
      expect(isValidShortcut('vault').valid).toBe(false);
    });

    it('rejects invalid characters and leading slash', () => {
      expect(isValidShortcut('/review').valid).toBe(false);
      expect(isValidShortcut('code/review').valid).toBe(false);
      expect(isValidShortcut('Skill Name').valid).toBe(false);
      expect(isValidShortcut('-review').valid).toBe(false);
    });

    it('allows undefined or empty shortcut', () => {
      expect(isValidShortcut(undefined).valid).toBe(true);
      expect(isValidShortcut('').valid).toBe(true);
    });
  });

  describe('validateSkill', () => {
    it('requires name and content', () => {
      const res1 = validateSkill({ name: '', content: 'some prompt' });
      expect(res1.valid).toBe(false);
      expect(res1.errors).toContain('Skill name is required');

      const res2 = validateSkill({ name: 'Code Review', content: '' });
      expect(res2.valid).toBe(false);
      expect(res2.errors).toContain('Skill prompt content is required');
    });

    it('validates shortcut format when present', () => {
      const res = validateSkill({
        name: 'Test',
        content: 'prompt',
        shortcut: 'skill',
      });
      expect(res.valid).toBe(false);
    });

    it('passes for valid input', () => {
      const res = validateSkill({
        name: 'Senior Review',
        content: 'Review: {{selected_text}}',
        shortcut: 'review',
      });
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });
  });

  describe('createSkillEntity', () => {
    it('creates skill with sk_ id prefix and current schema version', () => {
      const skill = createSkillEntity({
        name: 'Test Skill',
        content: 'Hello {{name}}',
        tags: ['test', 'demo'],
        favorite: true,
        variables: [],
      });

      expect(skill.id.startsWith('sk_')).toBe(true);
      expect(skill.schemaVersion).toBe(1);
      expect(skill.name).toBe('Test Skill');
      expect(skill.tags).toEqual(['test', 'demo']);
      expect(skill.favorite).toBe(true);
      expect(skill.usage.count).toBe(0);
      expect(skill.createdAt).toBeDefined();
      expect(skill.updatedAt).toBeDefined();
    });
  });
});

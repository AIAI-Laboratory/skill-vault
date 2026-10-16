import { expect, it } from 'vitest';
import {
  getSkillCollection,
  normalizeCollection,
  matchesSkillSearch,
  sortSkills,
  type SkillSort,
} from '../../src/domain/library';
import { SEED_SKILLS } from '../../src/infrastructure/storage/seed-data';
import { validateSkill } from '../../src/domain/skill';

it('searches multiple tags and text terms together, with exact hashtag matching', () => {
  const skill = { ...SEED_SKILLS[0], tags: ['coding', 'review', 'engineering'] };
  expect(matchesSkillSearch(skill, ' #CODING #review ')).toBe(true);
  expect(matchesSkillSearch(skill, '#coding,#engineering /review')).toBe(true);
  expect(matchesSkillSearch(skill, 'coding review')).toBe(true);
  expect(matchesSkillSearch(skill, '#coding #writing')).toBe(false);
  expect(matchesSkillSearch(skill, '#code')).toBe(false);
  expect(matchesSkillSearch(skill, '   ')).toBe(true);
});

it('groups old vaults by tags and supports explicit reassignment and custom collections', () => {
  expect(getSkillCollection(SEED_SKILLS[0])).toBe('Coding');
  expect(getSkillCollection(SEED_SKILLS[1])).toBe('Writing');
  expect(getSkillCollection({ ...SEED_SKILLS[0], collection: '' })).toBe('');
  expect(getSkillCollection({ ...SEED_SKILLS[0], collection: 'Research' })).toBe('Research');
  expect(normalizeCollection(' coding ')).toBe('Coding');
  expect(normalizeCollection(' My workflows ')).toBe('My workflows');
});

it('sorts each mode without mutating storage order and puts pins ahead of usage', () => {
  const older = {
    ...SEED_SKILLS[0],
    name: 'Zulu',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-02',
    usage: { count: 90, lastUsedAt: '2026-01-02' },
  };
  const newer = {
    ...SEED_SKILLS[1],
    name: 'Alpha',
    createdAt: '2026-02-01',
    updatedAt: '2026-02-02',
    usage: { count: 1, lastUsedAt: '2026-02-02' },
  };
  const skills = [older, newer];
  for (const mode of ['newest', 'name', 'recent', 'updated'] as SkillSort[])
    expect(sortSkills(skills, mode)[0]).toBe(newer);
  expect(sortSkills(skills, 'usage')[0]).toBe(older);
  expect(skills).toEqual([older, newer]);
  const pinned = { ...newer, pinned: true };
  expect(sortSkills([older, pinned], 'usage')[0]).toBe(pinned);
});

it('rejects invalid collection, pin and usage metadata at the import boundary', () => {
  const valid = { name: 'Test', content: 'Prompt' };
  expect(validateSkill({ ...valid, collection: 'x'.repeat(65) }).valid).toBe(false);
  expect(validateSkill({ ...valid, pinned: 'yes' as unknown as boolean }).valid).toBe(false);
  expect(validateSkill({ ...valid, usage: { count: -1 } }).valid).toBe(false);
  expect(validateSkill({ ...valid, usage: { count: 1, lastUsedAt: 'yesterday' } }).valid).toBe(
    false
  );
});

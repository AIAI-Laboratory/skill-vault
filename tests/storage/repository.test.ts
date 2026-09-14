import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRepository, StorageBackend } from '../../src/infrastructure/storage/repository';

class MockStorageBackend implements StorageBackend {
  private store: Record<string, any> = {};

  async get(keys: string | string[]): Promise<Record<string, any>> {
    const res: Record<string, any> = {};
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      if (k in this.store) {
        res[k] = this.store[k];
      }
    }
    return res;
  }

  async set(items: Record<string, any>): Promise<void> {
    for (const [k, v] of Object.entries(items)) {
      this.store[k] = JSON.parse(JSON.stringify(v));
    }
  }

  async remove(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      delete this.store[k];
    }
  }
}

describe('SkillRepository with Mock Storage', () => {
  let repo: SkillRepository;

  beforeEach(async () => {
    repo = new SkillRepository(new MockStorageBackend());
    await repo.init();
  });

  it('initializes with seed skills on empty storage', async () => {
    const list = await repo.list();
    expect(list.length).toBeGreaterThanOrEqual(4);
    const names = list.map((s) => s.name);
    expect(names).toContain('Code Review');
    expect(names).toContain('Explain Simply');
  });

  it('performs CRUD operations correctly', async () => {
    // Create
    const created = await repo.create({
      name: 'Custom Skill',
      shortcut: 'custom',
      description: 'A custom skill test',
      content: 'Do something with {{selected_text}}',
      tags: ['test'],
      favorite: true,
      variables: [],
    });

    expect(created.id).toBeDefined();
    expect(created.shortcut).toBe('custom');

    // Get
    const fetched = await repo.get(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('Custom Skill');

    // Update
    const updated = await repo.update(created.id, {
      name: 'Custom Skill Updated',
    });
    expect(updated.name).toBe('Custom Skill Updated');

    // Remove
    await repo.remove(created.id);
    const afterRemove = await repo.get(created.id);
    expect(afterRemove).toBeNull();
  });

  it('rejects duplicate shortcuts', async () => {
    await repo.create({
      name: 'First',
      shortcut: 'unique-shot',
      content: 'Content 1',
      tags: [],
      favorite: false,
      variables: [],
    });

    await expect(
      repo.create({
        name: 'Second',
        shortcut: 'unique-shot',
        content: 'Content 2',
        tags: [],
        favorite: false,
        variables: [],
      })
    ).rejects.toThrow(/already in use/);
  });

  it('ranks search results with shortcut exact matching first', async () => {
    const results = await repo.search('review');
    expect(results.length).toBeGreaterThan(0);
    // Code Review has shortcut 'review', should be top ranked
    expect(results[0].skill.shortcut).toBe('review');
  });

  it('exports and imports backup JSON correctly', async () => {
    const jsonStr = await repo.exportJson();
    expect(jsonStr).toContain('Code Review');

    // Create fresh repository and import
    const newRepo = new SkillRepository(new MockStorageBackend());
    const importRes = await newRepo.importJson(jsonStr);
    expect(importRes.imported).toBeGreaterThanOrEqual(4);

    const importedList = await newRepo.list();
    expect(importedList.length).toBeGreaterThanOrEqual(4);
  });
});

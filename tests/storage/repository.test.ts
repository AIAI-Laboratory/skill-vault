import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SkillRepository,
  StorageBackend,
  TRASH_RETENTION_MS,
} from '../../src/infrastructure/storage/repository';

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
  let backend: MockStorageBackend;

  beforeEach(async () => {
    backend = new MockStorageBackend();
    repo = new SkillRepository(backend);
    await repo.init();
  });

  afterEach(() => vi.useRealTimers());

  it('retains the full skill in trash but excludes it from active reads and backups', async () => {
    const skill = (await repo.list())[0];
    await repo.remove(skill.id);
    expect(await repo.get(skill.id)).toBeNull();
    expect((await repo.list()).some((item) => item.id === skill.id)).toBe(false);
    expect((await repo.search(skill.name)).some((item) => item.skill.id === skill.id)).toBe(false);
    expect(await repo.findByShortcut(skill.shortcut!)).toBeNull();
    expect(
      JSON.parse(await repo.exportJson()).skills.some(
        (item: { id: string }) => item.id === skill.id
      )
    ).toBe(false);
    expect((await repo.listTrash())[0].skill).toEqual(skill);
    expect((await backend.get(`skill:${skill.id}`))[`skill:${skill.id}`]).toBeNull();
  });

  it('persists across repository restarts and permanently purges at exactly 24 hours', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    const skill = (await repo.list())[0];
    await repo.remove(skill.id);
    const restarted = new SkillRepository(backend);
    await restarted.init();
    vi.setSystemTime(now + TRASH_RETENTION_MS - 1);
    expect(await restarted.listTrash()).toHaveLength(1);
    vi.setSystemTime(now + TRASH_RETENTION_MS);
    expect(await restarted.listTrash()).toEqual([]);
    expect((await backend.get('skill:trash'))['skill:trash']).toEqual([]);
    expect((await backend.get(`skill:${skill.id}`))[`skill:${skill.id}`]).toBeUndefined();
    await expect(restarted.restore(skill.id)).rejects.toThrow('no longer in trash');
  });

  it('restores the original metadata, usage and favorite before expiration', async () => {
    const original = (await repo.list())[0];
    await repo.recordUsage(original.id);
    const skill = await repo.get(original.id);
    await repo.remove(original.id);
    expect(await repo.restore(original.id)).toEqual(skill);
    expect(await repo.get(original.id)).toEqual(skill);
    expect(await repo.listTrash()).toEqual([]);
    expect((await repo.list()).filter((item) => item.id === original.id)).toHaveLength(1);
  });

  it('does not extend retention when a delete request is repeated', async () => {
    vi.useFakeTimers();
    const skill = (await repo.list())[0];
    await repo.remove(skill.id);
    const original = await repo.listTrash();
    vi.setSystemTime(Date.now() + 60_000);
    await repo.remove(skill.id);
    expect(await repo.listTrash()).toEqual(original);
  });

  it('purges only expired entries and starts a new deadline after restore and delete', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    const [first, second] = await repo.list();
    await repo.remove(first.id);
    vi.setSystemTime(now + 60_000);
    await repo.remove(second.id);
    await repo.restore(first.id);
    vi.setSystemTime(now + 120_000);
    await repo.remove(first.id);
    vi.setSystemTime(now + TRASH_RETENTION_MS + 60_000);
    expect((await repo.purgeExpiredTrash()).map((entry) => entry.skill.id)).toEqual([first.id]);
    expect((await repo.listTrash())[0].expiresAt).toBe(now + 120_000 + TRASH_RETENTION_MS);
  });

  it('restores without a conflicting shortcut and prevents imports overwriting trash IDs', async () => {
    const skill = (await repo.list())[0];
    await repo.remove(skill.id);
    await expect(repo.create(skill)).rejects.toThrow('already exists');
    const replacement = await repo.create({ ...skill, id: undefined, name: 'Replacement' });
    const restored = await repo.restore(skill.id);
    expect(restored).toEqual({ ...skill, shortcut: undefined });
    expect(await repo.findByShortcut(skill.shortcut!)).toEqual(replacement);
  });

  it('keeps the active skill if saving the trash copy fails', async () => {
    const skill = (await repo.list())[0];
    vi.spyOn(backend, 'set').mockRejectedValueOnce(new Error('Storage full'));
    await expect(repo.remove(skill.id)).rejects.toThrow('Storage full');
    expect(await repo.get(skill.id)).toEqual(skill);
    expect((await repo.list()).some((item) => item.id === skill.id)).toBe(true);
    expect(await repo.listTrash()).toEqual([]);
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

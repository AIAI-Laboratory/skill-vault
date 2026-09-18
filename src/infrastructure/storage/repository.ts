import { normalizeProviderUrls } from '../../domain/custom-provider';
import {
  Skill,
  CreateSkillInput,
  UpdateSkillInput,
  SkillSearchResult,
  SkillVaultSettings,
  DEFAULT_SETTINGS,
  TrashedSkill,
} from '../../domain/types';
import { createSkillEntity, validateSkill, CURRENT_SCHEMA_VERSION } from '../../domain/skill';
import { SEED_SKILLS } from './seed-data';

export const TRASH_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface StorageBackend {
  get(keys: string | string[]): Promise<Record<string, any>>;
  set(items: Record<string, any>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear?(): Promise<void>;
}

class ChromeStorageBackend implements StorageBackend {
  async get(keys: string | string[]): Promise<Record<string, any>> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local.get(keys);
    }
    // Fallback for tests or web environment
    const result: Record<string, any> = {};
    const keyArray = Array.isArray(keys) ? keys : [keys];
    for (const k of keyArray) {
      const val = localStorage.getItem(`sv:${k}`);
      if (val !== null) {
        try {
          result[k] = JSON.parse(val);
        } catch {
          result[k] = val;
        }
      }
    }
    return result;
  }

  async set(items: Record<string, any>): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local.set(items);
    }
    for (const [k, v] of Object.entries(items)) {
      localStorage.setItem(`sv:${k}`, JSON.stringify(v));
    }
  }

  async remove(keys: string | string[]): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local.remove(keys);
    }
    const keyArray = Array.isArray(keys) ? keys : [keys];
    for (const k of keyArray) {
      localStorage.removeItem(`sv:${k}`);
    }
  }
}

export class SkillRepository {
  private backend: StorageBackend;
  private static instance: SkillRepository;

  constructor(backend?: StorageBackend) {
    this.backend = backend || new ChromeStorageBackend();
  }

  public static getInstance(): SkillRepository {
    if (!SkillRepository.instance) {
      SkillRepository.instance = new SkillRepository();
    }
    return SkillRepository.instance;
  }

  /**
   * Initializes the repository, seeding default skills if empty.
   */
  async init(): Promise<void> {
    const meta = await this.backend.get(['meta:schemaVersion', 'skill:index']);
    if (!meta['meta:schemaVersion'] || !meta['skill:index']) {
      // Seed initial skills
      const itemsToSet: Record<string, any> = {
        'meta:schemaVersion': CURRENT_SCHEMA_VERSION,
        settings: DEFAULT_SETTINGS,
      };
      const index: string[] = [];

      for (const skill of SEED_SKILLS) {
        itemsToSet[`skill:${skill.id}`] = skill;
        index.push(skill.id);
      }
      itemsToSet['skill:index'] = index;

      await this.backend.set(itemsToSet);
    }
  }

  /**
   * Returns all skills.
   */
  async list(): Promise<Skill[]> {
    const indexData = await this.backend.get('skill:index');
    const index: string[] = indexData['skill:index'] || [];
    if (index.length === 0) {
      return [];
    }

    const keys = index.map((id) => `skill:${id}`);
    const skillsData = await this.backend.get(keys);

    const skills: Skill[] = [];
    for (const id of index) {
      const item = skillsData[`skill:${id}`];
      if (item) {
        skills.push(item as Skill);
      }
    }

    return skills;
  }

  /**
   * Retrieves a single skill by ID.
   */
  async get(id: string): Promise<Skill | null> {
    const data = await this.backend.get(`skill:${id}`);
    const skill = data[`skill:${id}`];
    return (skill as Skill) || null;
  }

  /**
   * Creates and persists a new skill.
   */
  async create(input: CreateSkillInput): Promise<Skill> {
    const validation = validateSkill(input);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    if (input.id) {
      const trash = await this.listTrash();
      if ((await this.get(input.id)) || trash.some((entry) => entry.skill.id === input.id)) {
        throw new Error(`Skill with ID '${input.id}' already exists in the vault or trash`);
      }
    }

    // Check unique shortcut
    if (input.shortcut) {
      const existing = await this.findByShortcut(input.shortcut);
      if (existing) {
        throw new Error(`Shortcut '/${input.shortcut}' is already in use by '${existing.name}'`);
      }
    }

    const skill = createSkillEntity(input);
    const indexData = await this.backend.get('skill:index');
    const index: string[] = indexData['skill:index'] || [];

    index.unshift(skill.id);

    await this.backend.set({
      [`skill:${skill.id}`]: skill,
      'skill:index': index,
    });

    return skill;
  }

  /**
   * Updates an existing skill.
   */
  async update(id: string, patch: UpdateSkillInput): Promise<Skill> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Skill with ID '${id}' not found`);
    }

    if (patch.shortcut && patch.shortcut !== existing.shortcut) {
      const duplicate = await this.findByShortcut(patch.shortcut);
      if (duplicate && duplicate.id !== id) {
        throw new Error(`Shortcut '/${patch.shortcut}' is already in use by '${duplicate.name}'`);
      }
    }

    const updated: Skill = {
      ...existing,
      ...patch,
      id: existing.id,
      schemaVersion: existing.schemaVersion,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      usage: {
        ...existing.usage,
        ...(patch.usage || {}),
      },
    };

    const validation = validateSkill(updated);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    await this.backend.set({
      [`skill:${id}`]: updated,
    });

    return updated;
  }

  /**
   * Moves a skill to trash for 24 hours, preserving its full contents for restoration.
   */
  async remove(id: string): Promise<void> {
    const skill = await this.get(id);
    if (!skill) return;
    const data = await this.backend.get(['skill:index', 'skill:trash']);
    const index: string[] = data['skill:index'] || [];
    const trash: TrashedSkill[] = data['skill:trash'] || [];
    const deletedAt = Date.now();

    // Save the recoverable copy and remove the active content in the same storage write.
    await this.backend.set({
      [`skill:${id}`]: null,
      'skill:index': index.filter((item) => item !== id),
      'skill:trash': [
        { skill, deletedAt, expiresAt: deletedAt + TRASH_RETENTION_MS },
        ...trash.filter((entry) => entry.skill.id !== id),
      ],
    });
  }

  async purgeExpiredTrash(): Promise<TrashedSkill[]> {
    const data = await this.backend.get('skill:trash');
    const trash: TrashedSkill[] = data['skill:trash'] || [];
    const now = Date.now();
    const remaining = trash.filter((entry) => entry.expiresAt > now);
    if (remaining.length !== trash.length) {
      // Remove the empty active slots too; the recoverable contents live only in trash.
      await this.backend.remove(
        trash.filter((entry) => entry.expiresAt <= now).map((entry) => `skill:${entry.skill.id}`)
      );
      await this.backend.set({ 'skill:trash': remaining });
    }
    return remaining;
  }

  async listTrash(): Promise<TrashedSkill[]> {
    return this.purgeExpiredTrash();
  }

  async restore(id: string): Promise<Skill> {
    const trash = await this.listTrash();
    const entry = trash.find((item) => item.skill.id === id);
    if (!entry) throw new Error('This skill is no longer in trash');
    if (await this.get(id)) throw new Error('A skill with this ID already exists');

    const skill = { ...entry.skill };
    // A new skill may have claimed this shortcut while the original was in trash.
    if (skill.shortcut && (await this.findByShortcut(skill.shortcut))) {
      skill.shortcut = undefined;
    }
    const data = await this.backend.get('skill:index');
    const index: string[] = data['skill:index'] || [];
    await this.backend.set({
      [`skill:${id}`]: skill,
      'skill:index': [id, ...index.filter((item) => item !== id)],
      'skill:trash': trash.filter((item) => item.skill.id !== id),
    });
    return skill;
  }

  /**
   * Finds a skill by exact shortcut match.
   */
  async findByShortcut(shortcut: string): Promise<Skill | null> {
    const normalized = shortcut.trim().toLowerCase();
    const all = await this.list();
    return all.find((s) => s.shortcut?.toLowerCase() === normalized) || null;
  }

  /**
   * Search ranking algorithm according to Section 40 specification.
   */
  async search(rawQuery: string): Promise<SkillSearchResult[]> {
    const query = rawQuery.trim().toLowerCase();
    const skills = await this.list();

    if (!query) {
      // Return all sorted by favorite and usage
      return skills
        .map((skill) => ({
          skill,
          score: (skill.favorite ? 20 : 0) + Math.min(skill.usage.count * 2, 20),
        }))
        .sort((a, b) => b.score - a.score);
    }

    const results: SkillSearchResult[] = [];

    for (const skill of skills) {
      let score = 0;
      const name = skill.name.toLowerCase();
      const shortcut = (skill.shortcut || '').toLowerCase();
      const desc = (skill.description || '').toLowerCase();
      const tags = (skill.tags || []).map((t) => t.toLowerCase());

      // 1. shortcut exact (+100)
      if (shortcut && shortcut === query) {
        score += 100;
      }
      // 2. name exact (+90)
      if (name === query) {
        score += 90;
      }
      // 3. name startsWith (+70)
      if (name.startsWith(query)) {
        score += 70;
      }
      // 4. shortcut startsWith (+60)
      if (shortcut && shortcut.startsWith(query)) {
        score += 60;
      }
      // 5. tag exact (+50)
      if (tags.some((t) => t === query)) {
        score += 50;
      }
      // 6. name contains (+40)
      if (name.includes(query)) {
        score += 40;
      }
      // 7. description contains (+20)
      if (desc.includes(query)) {
        score += 20;
      }
      // 8. tag contains (+25)
      if (tags.some((t) => t.includes(query))) {
        score += 25;
      }
      // 9. content contains (+15)
      if (skill.content.toLowerCase().includes(query)) {
        score += 15;
      }

      // Bonus modifiers
      if (score > 0) {
        if (skill.favorite) {
          score += 10;
        }
        // Recent use bonus (+0..10)
        score += Math.min(skill.usage.count, 10);
        results.push({ skill, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Increments the usage count and sets lastUsedAt timestamp.
   */
  async recordUsage(id: string): Promise<void> {
    const skill = await this.get(id);
    if (!skill) return;

    await this.update(id, {
      usage: {
        count: (skill.usage.count || 0) + 1,
        lastUsedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Retrieves extension settings.
   */
  async getSettings(): Promise<SkillVaultSettings> {
    const data = await this.backend.get('settings');
    return {
      ...DEFAULT_SETTINGS,
      ...(data['settings'] || {}),
    };
  }

  /**
   * Updates extension settings.
   */
  async updateSettings(patch: Partial<SkillVaultSettings>): Promise<SkillVaultSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...patch };
    updated.customProviderUrls = normalizeProviderUrls(updated.customProviderUrls);
    await this.backend.set({ settings: updated });
    return updated;
  }

  /**
   * Exports the entire vault as a JSON backup string.
   */
  async exportJson(): Promise<string> {
    const skills = await this.list();
    const settings = await this.getSettings();
    const exportData = {
      version: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      skills,
      settings,
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Imports skills from a JSON backup string.
   */
  async importJson(jsonStr: string): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error('Invalid JSON format');
    }

    const skillsToImport: any[] = Array.isArray(parsed) ? parsed : parsed.skills;
    if (!Array.isArray(skillsToImport)) {
      throw new Error('JSON backup missing skills array');
    }

    for (const item of skillsToImport) {
      try {
        const validation = validateSkill(item);
        if (!validation.valid) {
          errors.push(`Skill "${item.name || 'unnamed'}": ${validation.errors.join(', ')}`);
          continue;
        }

        // Check if skill with same ID or same shortcut exists
        const existing = await this.get(item.id);
        if (existing) {
          await this.update(item.id, item);
        } else {
          await this.create(item);
        }
        imported++;
      } catch (err: any) {
        errors.push(`Skill "${item.name || 'unnamed'}": ${err.message}`);
      }
    }

    return { imported, errors };
  }
}

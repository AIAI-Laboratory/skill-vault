import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SkillRepository,
  StorageBackend,
  TRASH_RETENTION_MS,
} from '../../src/infrastructure/storage/repository';
import { setupMessageRouter } from '../../src/background/message-router';
import {
  refreshTrashCleanup,
  setupTrashCleanup,
  TRASH_CLEANUP_ALARM,
} from '../../src/background/trash-cleanup';
import { enqueueTask } from '../../src/background/task-queue';
import {
  ExtensionMessage,
  ExtensionResponse,
  MessageType,
} from '../../src/infrastructure/messaging/protocol';

describe('trash background lifecycle', () => {
  let repository: SkillRepository;
  let store: Record<string, unknown>;
  let receiveMessage: (
    msg: ExtensionMessage,
    sender: unknown,
    reply: (response: ExtensionResponse) => void
  ) => boolean;
  let receiveAlarm: (alarm: { name: string }) => void;

  beforeEach(async () => {
    vi.useFakeTimers();
    store = {};
    const backend: StorageBackend = {
      get: async (keys) =>
        Object.fromEntries(
          (Array.isArray(keys) ? keys : [keys]).map((key) => [key, structuredClone(store[key])])
        ),
      set: async (items) => {
        Object.assign(store, structuredClone(items));
      },
      remove: async (keys) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
      },
    };
    repository = new SkillRepository(backend);
    await repository.init();
    vi.spyOn(SkillRepository, 'getInstance').mockReturnValue(repository);
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            receiveMessage = listener;
          }),
        },
      },
      alarms: {
        create: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(true),
        onAlarm: {
          addListener: vi.fn((listener) => {
            receiveAlarm = listener;
          }),
        },
      },
    });
    setupMessageRouter();
  });

  afterEach(async () => {
    await enqueueTask(async () => undefined);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function send(type: MessageType, id?: string): Promise<ExtensionResponse> {
    return new Promise((resolve) => {
      expect(receiveMessage({ id: 'test', version: 1, type, payload: { id } }, {}, resolve)).toBe(
        true
      );
    });
  }

  it('handles rapid deletes without dropping trash entries and schedules the first expiry', async () => {
    const skills = await repository.list();
    const responses = await Promise.all(skills.map((skill) => send('SKILL_DELETE', skill.id)));
    expect(responses.every((response) => response.ok)).toBe(true);
    expect(await repository.list()).toEqual([]);
    expect(await repository.listTrash()).toHaveLength(skills.length);
    expect(chrome.alarms.create).toHaveBeenLastCalledWith(TRASH_CLEANUP_ALARM, {
      when: Date.now() + TRASH_RETENTION_MS,
      periodInMinutes: 1,
    });
    expect((await send('SKILL_TRASH_LIST')).data).toHaveLength(skills.length);
    expect((await send('SKILL_RESTORE', skills[0].id)).ok).toBe(true);
    expect(await repository.get(skills[0].id)).toEqual(skills[0]);
  });

  it('rebuilds the alarm on worker startup and deletes overdue data with no panel open', async () => {
    const skill = (await repository.list())[0];
    await repository.remove(skill.id);
    setupTrashCleanup();
    await enqueueTask(async () => undefined);
    expect(chrome.alarms.create).toHaveBeenCalled();
    vi.setSystemTime(Date.now() + TRASH_RETENTION_MS);
    receiveAlarm({ name: TRASH_CLEANUP_ALARM });
    await enqueueTask(async () => undefined);
    expect(store['skill:trash']).toEqual([]);
    expect(store[`skill:${skill.id}`]).toBeUndefined();
    expect(await repository.listTrash()).toEqual([]);
    expect(chrome.alarms.clear).toHaveBeenCalledWith(TRASH_CLEANUP_ALARM);
  });

  it('cleans overdue trash on startup even if the alarm was lost while the browser was closed', async () => {
    const skill = (await repository.list())[0];
    await repository.remove(skill.id);
    vi.setSystemTime(Date.now() + TRASH_RETENTION_MS + 1);
    setupTrashCleanup();
    await enqueueTask(async () => undefined);
    expect(store['skill:trash']).toEqual([]);
    expect(store[`skill:${skill.id}`]).toBeUndefined();
    expect(await repository.listTrash()).toEqual([]);
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });

  it('schedules the next deadline and clears the alarm after the final restoration', async () => {
    const [first, second] = await repository.list();
    await send('SKILL_DELETE', first.id);
    vi.setSystemTime(Date.now() + 60_000);
    await send('SKILL_DELETE', second.id);
    await send('SKILL_RESTORE', first.id);
    expect(chrome.alarms.create).toHaveBeenLastCalledWith(TRASH_CLEANUP_ALARM, {
      when: Date.now() + TRASH_RETENTION_MS,
      periodInMinutes: 1,
    });
    await send('SKILL_RESTORE', second.id);
    expect(chrome.alarms.clear).toHaveBeenLastCalledWith(TRASH_CLEANUP_ALARM);
  });

  it('continues processing after a failed task', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await send('SKILL_RESTORE', 'missing')).ok).toBe(false);
    expect((await send('SKILL_LIST')).ok).toBe(true);
    await refreshTrashCleanup(repository);
  });
});

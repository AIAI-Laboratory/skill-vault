// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { sendExtensionMessage } from '../../src/infrastructure/messaging/client';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('chrome', undefined);
  vi.stubGlobal('location', new URL('http://localhost:5173/src/sidepanel/index.html'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('loads and persists a local vault, including edits, trash, restore and settings', async () => {
  const seeded = await sendExtensionMessage('SKILL_LIST');
  expect(seeded.length).toBeGreaterThan(0);
  const input = (name: string) => ({
    name,
    content: 'A local prompt',
    tags: ['local'],
    favorite: false,
    variables: [],
  });
  const created = await Promise.all([
    sendExtensionMessage('SKILL_CREATE', input('Local first')),
    sendExtensionMessage('SKILL_CREATE', input('Local second')),
  ]);
  expect(await sendExtensionMessage('SKILL_LIST')).toHaveLength(seeded.length + 2);
  const skill = created[0];
  await sendExtensionMessage('SKILL_UPDATE', { id: skill.id, patch: { favorite: true } });
  await sendExtensionMessage('SKILL_RECORD_USAGE', { id: skill.id });
  expect(await sendExtensionMessage('SKILL_GET', { id: skill.id })).toMatchObject({
    favorite: true,
    usage: { count: 1 },
  });
  expect(await sendExtensionMessage('SKILL_SEARCH', { query: skill.name })).toHaveLength(1);
  await sendExtensionMessage('SKILL_DELETE', { id: skill.id });
  expect(await sendExtensionMessage('SKILL_GET', { id: skill.id })).toBeNull();
  expect(await sendExtensionMessage('SKILL_TRASH_LIST')).toHaveLength(1);
  await sendExtensionMessage('SKILL_RESTORE', { id: skill.id });
  expect(await sendExtensionMessage('SKILL_TRASH_LIST')).toEqual([]);
  await sendExtensionMessage('SETTINGS_UPDATE', { theme: 'dark' });
  expect(await sendExtensionMessage('SETTINGS_GET')).toMatchObject({ theme: 'dark' });
  expect(JSON.parse(localStorage.getItem(`sv:skill:${skill.id}`)!)).toMatchObject({
    id: skill.id,
    favorite: true,
  });
  expect(await sendExtensionMessage('GET_DRAFT_SKILL')).toBeNull();
  expect(await sendExtensionMessage('CLEAR_DRAFT_SKILL')).toBe(true);
});

it('keeps extension messages on the runtime and surfaces connection errors', async () => {
  const sendMessage = vi.fn((_message, reply) => reply({ ok: true, data: [] }));
  vi.stubGlobal('chrome', { runtime: { sendMessage } });
  expect(await sendExtensionMessage('SKILL_LIST')).toEqual([]);
  expect(sendMessage).toHaveBeenCalledOnce();
  expect(localStorage.length).toBe(0);
  chrome.runtime.lastError = { message: 'Extension disconnected' };
  await expect(sendExtensionMessage('SKILL_LIST')).rejects.toThrow('Extension disconnected');
  expect(localStorage.length).toBe(0);
});

it('does not create a local vault when the extension runtime is missing on an extension page', async () => {
  vi.stubGlobal('location', new URL('chrome-extension://test/sidepanel.html'));
  await expect(sendExtensionMessage('SKILL_LIST')).rejects.toThrow(
    'chrome.runtime.sendMessage is not available'
  );
  expect(localStorage.length).toBe(0);
});

it('does not enable the local preview in production', async () => {
  vi.stubEnv('DEV', false);
  await expect(sendExtensionMessage('SKILL_LIST')).rejects.toThrow(
    'chrome.runtime.sendMessage is not available'
  );
  expect(localStorage.length).toBe(0);
});

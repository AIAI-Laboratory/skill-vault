import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillRepository, type StorageBackend } from '../../src/infrastructure/storage/repository';
import { formatSkillWithGemini } from '../../src/infrastructure/ai/gemini-format';
const { generateContent, client } = vi.hoisted(() => ({
  generateContent: vi.fn(),
  client: vi.fn(),
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor(options: unknown) {
      client(options);
    }
    models = { generateContent };
  },
  ThinkingLevel: { MEDIUM: 'MEDIUM' },
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY' },
}));
const draft = { name: '', description: '', shortcut: '', content: 'Review code.', tags: [] };
const result = {
  promptAction: 'improve',
  ...draft,
  name: 'Review',
  description: 'Code review',
  shortcut: 'review',
  content: '**Review code.**',
  tags: ['coding'],
};
let repository: SkillRepository;
let backend: StorageBackend;
beforeEach(async () => {
  vi.clearAllMocks();
  const data: Record<string, unknown> = {};
  backend = {
    get: async (keys) =>
      Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, data[key]])),
    set: async (items) => {
      Object.assign(data, items);
    },
    remove: async (keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
    },
  };
  repository = new SkillRepository(backend);
  await repository.init();
  generateContent.mockResolvedValue({ text: JSON.stringify(result) });
});
describe('Gemini formatting integration', () => {
  it('makes no API call without a saved key', async () => {
    await expect(formatSkillWithGemini(draft, undefined, repository)).rejects.toThrow('API key');
    expect(client).not.toHaveBeenCalled();
  });
  it('persists and removes the key independently of settings and backups', async () => {
    await repository.setGeminiApiKey('  test-secret  ');
    const reopened = new SkillRepository(backend);
    expect(await reopened.getGeminiApiKey()).toBe('test-secret');
    expect(JSON.stringify(await reopened.getSettings())).not.toContain('test-secret');
    expect(await reopened.exportJson()).not.toContain('test-secret');
    await reopened.setGeminiApiKey('');
    expect(await repository.getGeminiApiKey()).toBe('');
  });
  it('sends the requested model, schema and library metadata without other prompts', async () => {
    await repository.setGeminiApiKey('test-secret');
    const skills = await repository.list();
    await formatSkillWithGemini(draft, undefined, repository);
    expect(client).toHaveBeenCalledWith({ apiKey: 'test-secret' });
    const request = generateContent.mock.calls[0][0];
    expect(request).toMatchObject({
      model: 'gemini-3.5-flash-lite',
      config: { thinkingConfig: { thinkingLevel: 'MEDIUM' }, responseMimeType: 'application/json' },
    });
    const payload = JSON.parse(request.contents);
    expect(payload.draft).toEqual(draft);
    expect(payload.promptPolicy).toBe('improve_preserving_intent');
    expect(payload.existingSkills).toHaveLength(skills.length);
    expect(
      payload.existingSkills.every((skill: Record<string, unknown>) => !('content' in skill))
    ).toBe(true);
    expect(request.contents).not.toContain('test-secret');
  });
  it('requests improvements for long prompts and fills missing metadata', async () => {
    await repository.setGeminiApiKey('test-secret');
    const content = 'Keep these requirements intact. '.repeat(30);
    const improved = 'Retain these requirements unchanged. '.repeat(30);
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ ...result, content: improved }),
    });
    const resolved = await formatSkillWithGemini({ ...draft, content }, undefined, repository);
    expect(JSON.parse(generateContent.mock.calls[0][0].contents).promptPolicy).toBe(
      'improve_preserving_intent'
    );
    expect(resolved.content).toBe(improved);
    expect(resolved.description).toBe('Code review');
  });
  it('accepts clearer wording from Gemini for a simple prompt', async () => {
    await repository.setGeminiApiKey('test-secret');
    const content = 'Perform a code review.';
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ ...result, content }) });
    expect((await formatSkillWithGemini(draft, undefined, repository)).content).toBe(content);
  });
  it.each([400, 403, 429, 500])(
    'reports API error %i without leaking credentials',
    async (status) => {
      await repository.setGeminiApiKey('test-secret');
      generateContent.mockRejectedValue({ status, message: 'test-secret' });
      await expect(formatSkillWithGemini(draft, undefined, repository)).rejects.not.toThrow(
        'test-secret'
      );
    }
  );
  it('rejects invalid JSON and changed variables without changing saved skills', async () => {
    await repository.setGeminiApiKey('test-secret');
    const before = await repository.list();
    generateContent.mockResolvedValueOnce({ text: 'not json' });
    await expect(formatSkillWithGemini(draft, undefined, repository)).rejects.toThrow('unreadable');
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ ...result, content: 'Review {{new_input}}.' }),
    });
    await expect(formatSkillWithGemini(draft, undefined, repository)).rejects.toThrow(
      'changed code, URLs, or variables'
    );
    expect(await repository.list()).toEqual(before);
  });
});

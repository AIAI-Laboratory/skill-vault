import { afterEach, describe, expect, it, vi } from 'vitest';
import { syncCustomProviders } from '../../src/background/custom-providers';

afterEach(() => vi.unstubAllGlobals());
function mockChrome(registered = false, granted = true) {
  const scripting = {
    getRegisteredContentScripts: vi
      .fn()
      .mockResolvedValue(registered ? [{ id: 'custom-providers' }] : []),
    registerContentScripts: vi.fn().mockResolvedValue(undefined),
    updateContentScripts: vi.fn().mockResolvedValue(undefined),
    unregisterContentScripts: vi.fn().mockResolvedValue(undefined),
  };
  vi.stubGlobal('chrome', {
    scripting,
    permissions: { contains: vi.fn().mockResolvedValue(granted) },
  });
  return scripting;
}

describe('custom provider script registration', () => {
  it('registers granted hosts persistently without duplicating built-in scripts', async () => {
    const scripting = mockChrome();
    await syncCustomProviders(['https://chat.example.com']);
    expect(scripting.registerContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({
        matches: ['https://chat.example.com/*'],
        js: ['content.js'],
        persistAcrossSessions: true,
        excludeMatches: expect.arrayContaining(['https://chatgpt.com/*']),
      }),
    ]);
  });
  it('updates existing registrations and deduplicates port patterns', async () => {
    const scripting = mockChrome(true);
    await syncCustomProviders(['http://localhost:3000', 'http://localhost:4000']);
    expect(scripting.updateContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({ matches: ['http://localhost/*'] }),
    ]);
  });
  it.each([true, false])(
    'unregisters when URLs are removed or access is revoked (%s)',
    async (granted) => {
      const scripting = mockChrome(true, granted);
      await syncCustomProviders(granted ? [] : ['https://example.com']);
      expect(scripting.unregisterContentScripts).toHaveBeenCalledWith({
        ids: ['custom-providers'],
      });
      expect(scripting.registerContentScripts).not.toHaveBeenCalled();
    }
  );
});

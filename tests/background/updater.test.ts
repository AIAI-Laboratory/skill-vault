import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ALARM_UPDATE_CHECK,
  UPDATE_STATUS_STORAGE_KEY,
  isChromeWebStoreInstall,
  getStoredUpdateStatus,
  saveUpdateStatus,
  checkForUpdates,
  applyUpdate,
  handleNativeUpdateAvailable,
  setupAutoUpdater,
} from '../../src/background/updater';
import { UpdateInfo } from '../../src/domain/types';

/**
 * Creates a mock Response object returning JSON payload.
 *
 * @param data - Response body payload.
 * @returns Mocked fetch Response.
 */
function createMockJsonResponse(data: unknown): Response {
  return {
    ok: true,
    /** Resolves the mocked JSON payload. */
    json: async (): Promise<unknown> => data,
  } as unknown as Response;
}

describe('Background Updater Service', () => {
  let mockStorageLocal: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
  let mockAlarms: {
    create: ReturnType<typeof vi.fn>;
    onAlarm: { addListener: ReturnType<typeof vi.fn> };
  };
  let mockRuntime: {
    reload?: ReturnType<typeof vi.fn>;
    requestUpdateCheck?: ReturnType<typeof vi.fn>;
    onUpdateAvailable?: { addListener: ReturnType<typeof vi.fn> };
    getManifest: ReturnType<typeof vi.fn>;
  };

  /** Initializes mocked Chrome runtime, storage, and alarm globals before each test. */
  beforeEach(() => {
    vi.useFakeTimers();
    mockStorageLocal = {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    };
    mockAlarms = {
      create: vi.fn(),
      onAlarm: {
        addListener: vi.fn(),
      },
    };
    mockRuntime = {
      reload: vi.fn(),
      requestUpdateCheck: vi.fn().mockResolvedValue({ status: 'no_update' }),
      onUpdateAvailable: {
        addListener: vi.fn(),
      },
      getManifest: vi.fn().mockReturnValue({ version: '0.1.4' }),
    };

    vi.stubGlobal('chrome', {
      storage: {
        local: mockStorageLocal,
      },
      alarms: mockAlarms,
      runtime: mockRuntime,
    });
  });

  /** Restores timers and global stubs after each test. */
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Tests Chrome Web Store install detection via manifest update_url. */
  it('detects Chrome Web Store installs using manifest update_url', () => {
    expect(isChromeWebStoreInstall()).toBe(false);

    mockRuntime.getManifest.mockReturnValue({
      version: '0.1.4',
      update_url: 'https://clients2.google.com/service/update2/crx',
    });
    expect(isChromeWebStoreInstall()).toBe(true);
  });

  /** Tests reading uninitialized stored status returns default idle state. */
  it('returns default idle status when storage is empty', async () => {
    const status = await getStoredUpdateStatus();
    expect(status.currentVersion).toBe('0.1.4');
    expect(status.hasUpdate).toBe(false);
    expect(status.status).toBe('idle');
  });

  /** Tests reading stored status recalculates hasUpdate and preserves ready_to_install/downloading. */
  it('re-evaluates hasUpdate while preserving ready_to_install and downloading states', async () => {
    const readyCached: UpdateInfo = {
      currentVersion: '0.1.0',
      latestVersion: '0.1.5',
      hasUpdate: true,
      source: 'chrome_web_store',
      lastCheckedAt: 123456,
      status: 'ready_to_install',
    };
    mockStorageLocal.get.mockResolvedValue({ [UPDATE_STATUS_STORAGE_KEY]: readyCached });

    const readyStatus = await getStoredUpdateStatus();
    expect(readyStatus.currentVersion).toBe('0.1.4');
    expect(readyStatus.hasUpdate).toBe(true);
    expect(readyStatus.status).toBe('ready_to_install');

    const downloadingCached: UpdateInfo = {
      ...readyCached,
      status: 'downloading',
    };
    mockStorageLocal.get.mockResolvedValue({ [UPDATE_STATUS_STORAGE_KEY]: downloadingCached });

    const downloadingStatus = await getStoredUpdateStatus();
    expect(downloadingStatus.hasUpdate).toBe(true);
    expect(downloadingStatus.status).toBe('downloading');

    // Once the running version catches up, staged/downloading states become up_to_date:
    mockRuntime.getManifest.mockReturnValue({ version: '0.1.5' });
    const upToDateStatus = await getStoredUpdateStatus();
    expect(upToDateStatus.currentVersion).toBe('0.1.5');
    expect(upToDateStatus.hasUpdate).toBe(false);
    expect(upToDateStatus.status).toBe('up_to_date');
  });

  /** Tests persisting update status to chrome.storage.local. */
  it('persists update status to storage', async () => {
    const payload: UpdateInfo = {
      currentVersion: '0.1.4',
      latestVersion: '0.2.0',
      hasUpdate: true,
      lastCheckedAt: Date.now(),
      status: 'available',
    };
    await saveUpdateStatus(payload);
    expect(mockStorageLocal.set).toHaveBeenCalledWith({
      [UPDATE_STATUS_STORAGE_KEY]: payload,
    });
  });

  /** Tests Chrome Web Store installs rely on requestUpdateCheck instead of GitHub latest. */
  it('marks Chrome Web Store installs up_to_date when requestUpdateCheck returns no_update', async () => {
    mockRuntime.getManifest.mockReturnValue({
      version: '0.1.10',
      update_url: 'https://clients2.google.com/service/update2/crx',
    });
    mockRuntime.requestUpdateCheck?.mockResolvedValue({ status: 'no_update' });
    const mockFetch = vi.fn();

    const result = await checkForUpdates({
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(mockRuntime.requestUpdateCheck).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.hasUpdate).toBe(false);
    expect(result.status).toBe('up_to_date');
    expect(result.source).toBe('chrome_web_store');
  });

  /** Tests Chrome Web Store update_available marks status as downloading and fetches tag notes. */
  it('marks Chrome Web Store updates as downloading and enriches release notes by tag', async () => {
    mockRuntime.getManifest.mockReturnValue({
      version: '0.1.10',
      update_url: 'https://clients2.google.com/service/update2/crx',
    });
    mockRuntime.requestUpdateCheck?.mockResolvedValue({
      status: 'update_available',
      version: '0.1.11',
    });
    const mockFetch = vi.fn().mockResolvedValue(
      createMockJsonResponse({
        tag_name: 'v0.1.11',
        name: 'Skill Vault v0.1.11',
        body: 'Store release notes',
        html_url: 'https://github.com/AIAI-Laboratory/skill-vault/releases/tag/v0.1.11',
      })
    );

    const result = await checkForUpdates({
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(result.hasUpdate).toBe(true);
    expect(result.status).toBe('downloading');
    expect(result.source).toBe('chrome_web_store');
    expect(result.latestVersion).toBe('0.1.11');
    expect(result.releaseNotes).toBe('Store release notes');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/AIAI-Laboratory/skill-vault/releases/tags/v0.1.11',
      expect.any(Object)
    );
  });

  /** Tests Chrome Web Store throttled check reports an informative error when no update is cached. */
  it('reports throttled status when Chrome throttles requestUpdateCheck', async () => {
    mockRuntime.getManifest.mockReturnValue({
      version: '0.1.10',
      update_url: 'https://clients2.google.com/service/update2/crx',
    });
    mockRuntime.requestUpdateCheck?.mockResolvedValue({ status: 'throttled' });

    const result = await checkForUpdates();

    expect(result.hasUpdate).toBe(false);
    expect(result.status).toBe('error');
    expect(result.errorMessage).toContain('throttled');
  });

  /** Tests periodic checks do not overwrite an already staged ready_to_install update. */
  it('preserves an existing ready_to_install update during subsequent store checks', async () => {
    mockRuntime.getManifest.mockReturnValue({
      version: '0.1.10',
      update_url: 'https://clients2.google.com/service/update2/crx',
    });
    const staged: UpdateInfo = {
      currentVersion: '0.1.10',
      latestVersion: '0.1.11',
      hasUpdate: true,
      source: 'chrome_web_store',
      releaseName: 'Skill Vault v0.1.11',
      releaseNotes: 'Cached notes',
      lastCheckedAt: 1000,
      status: 'ready_to_install',
    };
    mockStorageLocal.get.mockResolvedValue({ [UPDATE_STATUS_STORAGE_KEY]: staged });

    const result = await checkForUpdates();

    expect(mockRuntime.requestUpdateCheck).not.toHaveBeenCalled();
    expect(result.status).toBe('ready_to_install');
    expect(result.latestVersion).toBe('0.1.11');
    expect(result.hasUpdate).toBe(true);
  });

  /** Tests unpacked installs check GitHub Releases for newer versions and zip assets. */
  it('detects a newer version from GitHub Releases for unpacked installs', async () => {
    const mockRelease = {
      tag_name: 'v0.2.0',
      name: 'Skill Vault v0.2.0 Release',
      body: '### Features\n- Added auto update mechanism\n- Version display',
      published_at: '2026-10-30T00:00:00Z',
      html_url: 'https://github.com/AIAI-Laboratory/skill-vault/releases/tag/v0.2.0',
      assets: [
        {
          name: 'skill-vault-v0.2.0.zip',
          browser_download_url:
            'https://github.com/AIAI-Laboratory/skill-vault/releases/download/v0.2.0/skill-vault-v0.2.0.zip',
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue(createMockJsonResponse(mockRelease));

    const result = await checkForUpdates({
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe('0.2.0');
    expect(result.source).toBe('github');
    expect(result.status).toBe('available');
    expect(result.downloadUrl).toBe(
      'https://github.com/AIAI-Laboratory/skill-vault/releases/download/v0.2.0/skill-vault-v0.2.0.zip'
    );
    expect(result.releaseNotes).toContain('Added auto update mechanism');
    expect(mockStorageLocal.set).toHaveBeenCalled();
  });

  /** Tests checking for updates when current version is already up to date. */
  it('marks status as up_to_date when latest release matches current version', async () => {
    const mockRelease = {
      tag_name: 'v0.1.4',
      name: 'Skill Vault v0.1.4',
      body: 'Bug fixes',
      assets: [],
    };

    const mockFetch = vi.fn().mockResolvedValue(createMockJsonResponse(mockRelease));

    const result = await checkForUpdates({
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(result.hasUpdate).toBe(false);
    expect(result.status).toBe('up_to_date');
  });

  /** Tests handling of network or HTTP error during update check. */
  it('handles release fetch failure with error status without throwing', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await checkForUpdates({
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(result.hasUpdate).toBe(false);
    expect(result.status).toBe('error');
    expect(result.errorMessage).toContain('404');
  });

  /** Tests applying a ready_to_install Chrome Web Store update creates backup and reloads. */
  it('creates safety backup and schedules extension reload when update is ready_to_install', async () => {
    const staged: UpdateInfo = {
      currentVersion: '0.1.4',
      latestVersion: '0.2.0',
      hasUpdate: true,
      source: 'chrome_web_store',
      lastCheckedAt: Date.now(),
      status: 'ready_to_install',
    };
    mockStorageLocal.get.mockResolvedValue({ [UPDATE_STATUS_STORAGE_KEY]: staged });

    const mockRepo = {
      createSafetyBackup: vi.fn().mockResolvedValue({
        backupKey: 'backup:pre-update-1234',
        skillCount: 3,
        timestamp: 1234,
      }),
    };

    const result = await applyUpdate(mockRepo as never);
    expect(mockRepo.createSafetyBackup).toHaveBeenCalledWith('pre-update');
    expect(result.success).toBe(true);
    expect(result.reloadTriggered).toBe(true);

    vi.advanceTimersByTime(200);
    expect(mockRuntime.reload).toHaveBeenCalled();
  });

  /** Tests applying a GitHub update does not blindly reload and returns downloadUrl instead. */
  it('returns downloadUrl without reloading when update is from GitHub (unpacked install)', async () => {
    const githubUpdate: UpdateInfo = {
      currentVersion: '0.1.4',
      latestVersion: '0.2.0',
      hasUpdate: true,
      source: 'github',
      downloadUrl:
        'https://github.com/AIAI-Laboratory/skill-vault/releases/download/v0.2.0/app.zip',
      lastCheckedAt: Date.now(),
      status: 'available',
    };
    mockStorageLocal.get.mockResolvedValue({ [UPDATE_STATUS_STORAGE_KEY]: githubUpdate });

    const mockRepo = {
      createSafetyBackup: vi.fn().mockResolvedValue({
        backupKey: 'backup:pre-update-1234',
        skillCount: 3,
        timestamp: 1234,
      }),
    };

    const result = await applyUpdate(mockRepo as never);
    expect(mockRepo.createSafetyBackup).toHaveBeenCalledWith('pre-update');
    expect(result.success).toBe(true);
    expect(result.reloadTriggered).toBe(false);
    expect(result.downloadUrl).toBe(githubUpdate.downloadUrl);

    vi.advanceTimersByTime(200);
    expect(mockRuntime.reload).not.toHaveBeenCalled();
  });

  /** Tests applying an update while Chrome is still downloading does not reload or back up. */
  it('refuses to reload while Chrome Web Store update is still downloading', async () => {
    const downloading: UpdateInfo = {
      currentVersion: '0.1.4',
      latestVersion: '0.2.0',
      hasUpdate: true,
      source: 'chrome_web_store',
      lastCheckedAt: Date.now(),
      status: 'downloading',
    };
    mockStorageLocal.get.mockResolvedValue({ [UPDATE_STATUS_STORAGE_KEY]: downloading });

    const mockRepo = {
      createSafetyBackup: vi.fn(),
    };

    const result = await applyUpdate(mockRepo as never);
    expect(mockRepo.createSafetyBackup).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.reloadTriggered).toBe(false);

    vi.advanceTimersByTime(200);
    expect(mockRuntime.reload).not.toHaveBeenCalled();
  });

  /** Tests handling native onUpdateAvailable event sets ready_to_install and enriches notes. */
  it('marks status as ready_to_install on native Chrome update event', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockJsonResponse({
        tag_name: 'v0.3.0',
        name: 'Skill Vault v0.3.0',
        body: 'Native update release notes',
        html_url: 'https://github.com/AIAI-Laboratory/skill-vault/releases/tag/v0.3.0',
      })
    );

    await handleNativeUpdateAvailable(
      { version: '0.3.0' },
      { fetchImpl: mockFetch as unknown as typeof fetch }
    );

    expect(mockStorageLocal.set).toHaveBeenCalledWith({
      [UPDATE_STATUS_STORAGE_KEY]: expect.objectContaining({
        status: 'ready_to_install',
        source: 'chrome_web_store',
        latestVersion: '0.3.0',
        hasUpdate: true,
        releaseNotes: 'Native update release notes',
      }),
    });
  });

  /** Tests setupAutoUpdater schedules alarms and registers listeners. */
  it('registers periodic alarm and listeners in setupAutoUpdater', () => {
    setupAutoUpdater();
    expect(mockAlarms.create).toHaveBeenCalledWith(ALARM_UPDATE_CHECK, {
      periodInMinutes: 360,
    });
    expect(mockAlarms.onAlarm.addListener).toHaveBeenCalled();
    expect(mockRuntime.onUpdateAvailable?.addListener).toHaveBeenCalled();
  });
});

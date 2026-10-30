import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ALARM_UPDATE_CHECK,
  UPDATE_STATUS_STORAGE_KEY,
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
    onUpdateAvailable?: { addListener: ReturnType<typeof vi.fn> };
    getManifest: ReturnType<typeof vi.fn>;
  };

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

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Tests reading uninitialized stored status returns default idle state. */
  it('returns default idle status when storage is empty', async () => {
    const status = await getStoredUpdateStatus();
    expect(status.currentVersion).toBe('0.1.4');
    expect(status.hasUpdate).toBe(false);
    expect(status.status).toBe('idle');
  });

  /** Tests reading stored status recalculates hasUpdate correctly. */
  it('re-evaluates hasUpdate based on current running version', async () => {
    const cached: UpdateInfo = {
      currentVersion: '0.1.0',
      latestVersion: '0.1.5',
      hasUpdate: true,
      lastCheckedAt: 123456,
      status: 'available',
    };
    mockStorageLocal.get.mockResolvedValue({ [UPDATE_STATUS_STORAGE_KEY]: cached });

    const status = await getStoredUpdateStatus();
    expect(status.currentVersion).toBe('0.1.4');
    expect(status.hasUpdate).toBe(true);
    expect(status.status).toBe('available');

    // If current version has caught up with latest:
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

  /** Tests checking for updates identifies newer version and zip assets. */
  it('detects a newer version from GitHub Releases', async () => {
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

  /** Tests applying update triggers safety backup and reloads extension. */
  it('creates safety backup and schedules extension reload when applying update', async () => {
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

  /** Tests handling native onUpdateAvailable event sets ready_to_install. */
  it('marks status as ready_to_install on native Chrome update event', async () => {
    await handleNativeUpdateAvailable({ version: '0.3.0' });
    expect(mockStorageLocal.set).toHaveBeenCalledWith({
      [UPDATE_STATUS_STORAGE_KEY]: expect.objectContaining({
        status: 'ready_to_install',
        latestVersion: '0.3.0',
        hasUpdate: true,
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

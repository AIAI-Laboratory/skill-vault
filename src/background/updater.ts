import { getCurrentAppVersion, isUpdateAvailable, stripVersionPrefix } from '../domain/version';
import { UpdateInfo } from '../domain/types';
import { SkillRepository } from '../infrastructure/storage/repository';

/** The alarm name used by chrome.alarms for recurring update checks. */
export const ALARM_UPDATE_CHECK = 'sv:auto-update-check';

/** Storage key where the latest update check results are cached. */
export const UPDATE_STATUS_STORAGE_KEY = 'meta:update_status';

/** Default GitHub repository slug where Skill Vault releases are published. */
export const DEFAULT_GITHUB_REPO = 'AIAI-Laboratory/skill-vault';

/** Default interval between automatic update checks in minutes (6 hours). */
export const UPDATE_INTERVAL_MINUTES = 360;

/** Shape of an individual asset in a GitHub release. */
interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

/** Shape of the GitHub Releases API response. */
interface GitHubReleaseResponse {
  tag_name: string;
  name?: string;
  body?: string;
  published_at?: string;
  html_url?: string;
  assets?: GitHubAsset[];
}

/**
 * Predicate to identify downloadable zip assets from release asset lists.
 *
 * @param asset - GitHub release asset object.
 * @returns True if the asset is a ZIP file or Skill Vault archive.
 */
function isZipReleaseAsset(asset: GitHubAsset): boolean {
  return asset.name.endsWith('.zip') || asset.name.includes('skill-vault');
}

/**
 * Executes extension reload after a short delay for message delivery.
 */
function triggerExtensionReload(): void {
  chrome.runtime.reload();
}

/**
 * Handles periodic alarms triggered by chrome.alarms.
 *
 * @param alarm - Alarm event payload.
 */
async function handlePeriodicAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name !== ALARM_UPDATE_CHECK) {
    return;
  }
  try {
    const settings = await SkillRepository.getInstance().getSettings();
    if (settings.autoCheckUpdates) {
      await checkForUpdates();
    }
  } catch (err) {
    console.warn('[SkillVault][Updater] Periodic update check error:', err);
  }
}

/**
 * Callback receiving native update notifications from Chrome runtime.
 *
 * @param details - Update event payload containing the available version.
 */
function onChromeUpdateAvailable(details: { version: string }): void {
  void handleNativeUpdateAvailable(details);
}

/**
 * Wrapper callback executing periodic alarm checks.
 *
 * @param alarm - Triggered alarm instance.
 */
function onAlarmTriggered(alarm: chrome.alarms.Alarm): void {
  void handlePeriodicAlarm(alarm);
}

/**
 * Reads the cached update status from extension storage.
 *
 * @param storage - Optional storage object with a get method (defaults to chrome.storage.local).
 * @returns The cached UpdateInfo, or a clean idle state if not yet checked.
 */
export async function getStoredUpdateStatus(storage?: {
  get: (keys: string | string[]) => Promise<Record<string, unknown>>;
}): Promise<UpdateInfo> {
  const currentVersion = getCurrentAppVersion();
  try {
    let raw: Record<string, unknown> = {};
    if (storage) {
      raw = await storage.get(UPDATE_STATUS_STORAGE_KEY);
    } else if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      raw = await chrome.storage.local.get(UPDATE_STATUS_STORAGE_KEY);
    }
    const cached = raw[UPDATE_STATUS_STORAGE_KEY] as UpdateInfo | undefined;
    if (cached) {
      const hasUpdate = cached.latestVersion
        ? isUpdateAvailable(currentVersion, cached.latestVersion)
        : false;
      return {
        ...cached,
        currentVersion,
        hasUpdate,
        status: hasUpdate
          ? 'available'
          : cached.status === 'available'
            ? 'up_to_date'
            : cached.status,
      };
    }
  } catch (err) {
    console.warn('[SkillVault][Updater] Could not read stored update status:', err);
  }

  return {
    currentVersion,
    hasUpdate: false,
    lastCheckedAt: 0,
    status: 'idle',
  };
}

/**
 * Persists update check results to extension storage.
 *
 * @param status - The UpdateInfo payload to write.
 * @param storage - Optional storage object with a set method (defaults to chrome.storage.local).
 */
export async function saveUpdateStatus(
  status: UpdateInfo,
  storage?: { set: (items: Record<string, unknown>) => Promise<void> }
): Promise<void> {
  try {
    if (storage) {
      await storage.set({ [UPDATE_STATUS_STORAGE_KEY]: status });
    } else if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [UPDATE_STATUS_STORAGE_KEY]: status });
    }
  } catch (err) {
    console.warn('[SkillVault][Updater] Could not persist update status:', err);
  }
}

/**
 * Checks GitHub Releases and native Chrome extension APIs for newer releases.
 *
 * @param options - Optional configuration for custom fetch, repo URL, or storage.
 * @returns The updated UpdateInfo after comparing versions.
 */
export async function checkForUpdates(options?: {
  repo?: string;
  fetchImpl?: typeof fetch;
  storage?: {
    get: (keys: string | string[]) => Promise<Record<string, unknown>>;
    set: (items: Record<string, unknown>) => Promise<void>;
  };
}): Promise<UpdateInfo> {
  const currentVersion = getCurrentAppVersion();
  const repo = options?.repo || DEFAULT_GITHUB_REPO;
  const fetcher = options?.fetchImpl || fetch;

  const initialStatus: UpdateInfo = {
    currentVersion,
    hasUpdate: false,
    lastCheckedAt: Date.now(),
    status: 'checking',
  };
  await saveUpdateStatus(initialStatus, options?.storage);

  try {
    const response = await fetcher(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`Release check failed with HTTP ${response.status}`);
    }

    const data = (await response.json()) as GitHubReleaseResponse;
    const latestRaw = data.tag_name || '';
    const latestVersion = stripVersionPrefix(latestRaw);
    const hasUpdate = isUpdateAvailable(currentVersion, latestVersion);

    // Locate the first downloadable zip asset or fallback to html release page
    const zipAsset = data.assets?.find(isZipReleaseAsset);
    const downloadUrl = zipAsset?.browser_download_url || data.html_url;

    const result: UpdateInfo = {
      currentVersion,
      latestVersion,
      hasUpdate,
      releaseName: data.name || `Skill Vault v${latestVersion}`,
      releaseNotes: data.body || '',
      publishedAt: data.published_at,
      downloadUrl,
      htmlUrl: data.html_url,
      lastCheckedAt: Date.now(),
      status: hasUpdate ? 'available' : 'up_to_date',
    };

    await saveUpdateStatus(result, options?.storage);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown update error';
    const failedStatus: UpdateInfo = {
      currentVersion,
      hasUpdate: false,
      lastCheckedAt: Date.now(),
      status: 'error',
      errorMessage: errorMsg,
    };
    await saveUpdateStatus(failedStatus, options?.storage);
    return failedStatus;
  }
}

/**
 * Handles applying an update by creating a safety backup and initiating extension reload.
 *
 * @param repository - Optional SkillRepository instance for performing pre-update backups.
 * @returns Result object describing whether the reload was triggered.
 */
export async function applyUpdate(
  repository?: SkillRepository
): Promise<{ success: boolean; reloadTriggered: boolean; message: string; downloadUrl?: string }> {
  const repo = repository || SkillRepository.getInstance();

  // Create an automatic safety snapshot before updating
  await repo.createSafetyBackup('pre-update');

  const status = await getStoredUpdateStatus();
  const downloadUrl = status.downloadUrl;

  if (typeof chrome !== 'undefined' && typeof chrome.runtime?.reload === 'function') {
    // Schedule reload asynchronously to allow response message delivery
    setTimeout(triggerExtensionReload, 150);

    return {
      success: true,
      reloadTriggered: true,
      message: 'Extension update in progress. Reloading now...',
      downloadUrl,
    };
  }

  return {
    success: true,
    reloadTriggered: false,
    message: 'Safety backup saved. Download the latest release to complete updating.',
    downloadUrl,
  };
}

/**
 * Handles Chrome's native onUpdateAvailable event by marking status as ready to install.
 *
 * @param details - The update details provided by Chrome runtime.
 */
export async function handleNativeUpdateAvailable(details: { version: string }): Promise<void> {
  const currentVersion = getCurrentAppVersion();
  const updateInfo: UpdateInfo = {
    currentVersion,
    latestVersion: details.version,
    hasUpdate: true,
    releaseName: `Skill Vault v${details.version}`,
    lastCheckedAt: Date.now(),
    status: 'ready_to_install',
  };
  await saveUpdateStatus(updateInfo);
}

/**
 * Initializes automatic update scheduling and listeners for the background worker.
 */
export function setupAutoUpdater(): void {
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    return;
  }

  // Register recurring alarm for periodic checks
  chrome.alarms.create(ALARM_UPDATE_CHECK, {
    periodInMinutes: UPDATE_INTERVAL_MINUTES,
  });

  // Listen for alarm triggers
  chrome.alarms.onAlarm.addListener(onAlarmTriggered);

  // Listen for native Chrome update notifications
  if (chrome.runtime?.onUpdateAvailable) {
    chrome.runtime.onUpdateAvailable.addListener(onChromeUpdateAvailable);
  }
}

import { getCurrentAppVersion, isUpdateAvailable, stripVersionPrefix } from '../domain/version';
import { UpdateCheckStatus, UpdateInfo } from '../domain/types';
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

/** Storage adapter accepted by updater persistence helpers. */
export interface UpdateStorageAdapter {
  get: (keys: string | string[]) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
}

/** Result returned by Chrome's native runtime update check API. */
export interface ChromeUpdateCheckResult {
  status: 'throttled' | 'no_update' | 'update_available';
  version?: string;
}

/** Release metadata enriched from GitHub Releases for display purposes. */
interface ReleaseMetadata {
  releaseName?: string;
  releaseNotes?: string;
  publishedAt?: string;
  downloadUrl?: string;
  htmlUrl?: string;
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
 * Determines whether the currently running extension is managed by the Chrome Web Store.
 *
 * @remarks
 * Chrome automatically populates `update_url` in the runtime manifest for extensions
 * installed from the Chrome Web Store, whereas unpacked or manually sideloaded builds omit it.
 *
 * @returns True when the runtime manifest declares an `update_url`.
 */
export function isChromeWebStoreInstall(): boolean {
  if (typeof chrome === 'undefined' || typeof chrome.runtime?.getManifest !== 'function') {
    return false;
  }
  try {
    const manifest = chrome.runtime.getManifest();
    return Boolean(manifest?.update_url);
  } catch {
    return false;
  }
}

/**
 * Resolves the normalized status for a cached update record against the current version.
 *
 * @param cachedStatus - Previously stored update lifecycle status.
 * @param hasUpdate - Whether the cached version is still newer than the running version.
 * @returns Normalized lifecycle status preserving staged and downloading states.
 */
function normalizeCachedStatus(
  cachedStatus: UpdateCheckStatus,
  hasUpdate: boolean
): UpdateCheckStatus {
  if (hasUpdate) {
    if (cachedStatus === 'ready_to_install' || cachedStatus === 'downloading') {
      return cachedStatus;
    }
    return 'available';
  }
  if (
    cachedStatus === 'available' ||
    cachedStatus === 'ready_to_install' ||
    cachedStatus === 'downloading'
  ) {
    return 'up_to_date';
  }
  return cachedStatus;
}

/**
 * Fetches optional GitHub release metadata for a specific version tag.
 *
 * @param version - Semantic version string (with or without leading "v").
 * @param repo - GitHub repository slug in `owner/repo` format.
 * @param fetcher - Fetch implementation used for the HTTP request.
 * @returns Release notes and links if found, or an empty object on failure.
 */
async function fetchGitHubReleaseByTag(
  version: string,
  repo: string,
  fetcher: typeof fetch
): Promise<ReleaseMetadata> {
  try {
    const normalized = stripVersionPrefix(version);
    const response = await fetcher(
      `https://api.github.com/repos/${repo}/releases/tags/v${normalized}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    if (!response.ok) {
      return {};
    }
    const data = (await response.json()) as GitHubReleaseResponse;
    const zipAsset = data.assets?.find(isZipReleaseAsset);
    return {
      releaseName: data.name || `Skill Vault v${normalized}`,
      releaseNotes: data.body || '',
      publishedAt: data.published_at,
      downloadUrl: zipAsset?.browser_download_url || data.html_url,
      htmlUrl: data.html_url,
    };
  } catch {
    return {};
  }
}

/**
 * Invokes Chrome's native `requestUpdateCheck` API to query the Chrome Web Store.
 *
 * @returns The Chrome Web Store update check result.
 * @throws Error when `chrome.runtime.requestUpdateCheck` is unavailable.
 */
async function requestNativeUpdateCheck(): Promise<ChromeUpdateCheckResult> {
  if (typeof chrome === 'undefined' || typeof chrome.runtime?.requestUpdateCheck !== 'function') {
    throw new Error('Chrome Web Store update check API is unavailable');
  }
  const result = await chrome.runtime.requestUpdateCheck();
  return {
    status: result.status,
    version: result.version,
  };
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
        status: normalizeCachedStatus(cached.status, hasUpdate),
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
 * Checks for updates via the Chrome Web Store native API for store-managed installs.
 *
 * @param currentVersion - Currently running semantic version.
 * @param previousStatus - Previously cached update status to preserve staged updates.
 * @param options - Configuration for repository, fetch, storage, and native check runner.
 * @returns The updated UpdateInfo reflecting Chrome Web Store availability.
 */
async function checkChromeWebStoreUpdate(
  currentVersion: string,
  previousStatus: UpdateInfo,
  options: {
    repo: string;
    fetcher: typeof fetch;
    storage?: UpdateStorageAdapter;
    requestUpdateCheckImpl: () => Promise<ChromeUpdateCheckResult>;
  }
): Promise<UpdateInfo> {
  // Never downgrade an already-downloaded update that is ready to install on reload.
  if (
    previousStatus.status === 'ready_to_install' &&
    previousStatus.hasUpdate &&
    previousStatus.latestVersion
  ) {
    const metadata =
      previousStatus.releaseNotes === undefined
        ? await fetchGitHubReleaseByTag(previousStatus.latestVersion, options.repo, options.fetcher)
        : {};
    const preserved: UpdateInfo = {
      ...previousStatus,
      ...metadata,
      currentVersion,
      source: 'chrome_web_store',
      hasUpdate: true,
      status: 'ready_to_install',
      lastCheckedAt: Date.now(),
    };
    await saveUpdateStatus(preserved, options.storage);
    return preserved;
  }

  const initialStatus: UpdateInfo = {
    currentVersion,
    hasUpdate: false,
    source: 'chrome_web_store',
    lastCheckedAt: Date.now(),
    status: 'checking',
  };
  await saveUpdateStatus(initialStatus, options.storage);

  try {
    const checkResult = await options.requestUpdateCheckImpl();

    if (checkResult.status === 'update_available') {
      const latestVersion = checkResult.version
        ? stripVersionPrefix(checkResult.version)
        : undefined;
      const hasUpdate = latestVersion ? isUpdateAvailable(currentVersion, latestVersion) : true;

      if (!hasUpdate) {
        const upToDate: UpdateInfo = {
          currentVersion,
          latestVersion: currentVersion,
          hasUpdate: false,
          source: 'chrome_web_store',
          lastCheckedAt: Date.now(),
          status: 'up_to_date',
        };
        await saveUpdateStatus(upToDate, options.storage);
        return upToDate;
      }

      const metadata = latestVersion
        ? await fetchGitHubReleaseByTag(latestVersion, options.repo, options.fetcher)
        : {};
      const downloading: UpdateInfo = {
        currentVersion,
        latestVersion,
        hasUpdate: true,
        source: 'chrome_web_store',
        releaseName:
          metadata.releaseName ||
          (latestVersion ? `Skill Vault v${latestVersion}` : 'Skill Vault update'),
        releaseNotes: metadata.releaseNotes,
        publishedAt: metadata.publishedAt,
        downloadUrl: metadata.downloadUrl,
        htmlUrl: metadata.htmlUrl,
        lastCheckedAt: Date.now(),
        status: 'downloading',
      };
      await saveUpdateStatus(downloading, options.storage);
      return downloading;
    }

    if (checkResult.status === 'throttled') {
      if (previousStatus.hasUpdate) {
        const preserved: UpdateInfo = {
          ...previousStatus,
          currentVersion,
          source: 'chrome_web_store',
          lastCheckedAt: Date.now(),
        };
        await saveUpdateStatus(preserved, options.storage);
        return preserved;
      }
      const throttledStatus: UpdateInfo = {
        currentVersion,
        hasUpdate: false,
        source: 'chrome_web_store',
        lastCheckedAt: Date.now(),
        status: 'error',
        errorMessage: 'Chrome Web Store update check was throttled. Please try again later.',
      };
      await saveUpdateStatus(throttledStatus, options.storage);
      return throttledStatus;
    }

    const upToDate: UpdateInfo = {
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      source: 'chrome_web_store',
      lastCheckedAt: Date.now(),
      status: 'up_to_date',
    };
    await saveUpdateStatus(upToDate, options.storage);
    return upToDate;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown update error';
    const failedStatus: UpdateInfo = {
      currentVersion,
      hasUpdate: false,
      source: 'chrome_web_store',
      lastCheckedAt: Date.now(),
      status: 'error',
      errorMessage: errorMsg,
    };
    await saveUpdateStatus(failedStatus, options.storage);
    return failedStatus;
  }
}

/**
 * Checks for updates via the Chrome Web Store for store-managed installs,
 * or falls back to GitHub Releases for unpacked/manual installs.
 *
 * @param options - Optional configuration for custom fetch, repo URL, storage, or install channel.
 * @returns The updated UpdateInfo after comparing versions.
 */
export async function checkForUpdates(options?: {
  repo?: string;
  fetchImpl?: typeof fetch;
  storage?: UpdateStorageAdapter;
  isStoreInstall?: boolean;
  requestUpdateCheckImpl?: () => Promise<ChromeUpdateCheckResult>;
}): Promise<UpdateInfo> {
  const currentVersion = getCurrentAppVersion();
  const repo = options?.repo || DEFAULT_GITHUB_REPO;
  const fetcher = options?.fetchImpl || fetch;
  const previousStatus = await getStoredUpdateStatus(options?.storage);
  const storeManaged = options?.isStoreInstall ?? isChromeWebStoreInstall();

  if (storeManaged) {
    return checkChromeWebStoreUpdate(currentVersion, previousStatus, {
      repo,
      fetcher,
      storage: options?.storage,
      requestUpdateCheckImpl: options?.requestUpdateCheckImpl || requestNativeUpdateCheck,
    });
  }

  const initialStatus: UpdateInfo = {
    currentVersion,
    hasUpdate: false,
    source: 'github',
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
      source: 'github',
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
      source: 'github',
      lastCheckedAt: Date.now(),
      status: 'error',
      errorMessage: errorMsg,
    };
    await saveUpdateStatus(failedStatus, options?.storage);
    return failedStatus;
  }
}

/**
 * Handles applying an update by creating a safety backup and either reloading a staged
 * Chrome Web Store update or returning the manual download URL for unpacked installs.
 *
 * @param repository - Optional SkillRepository instance for performing pre-update backups.
 * @param options - Optional storage override for reading cached update state.
 * @returns Result object describing whether a reload was triggered or manual download is required.
 */
export async function applyUpdate(
  repository?: SkillRepository,
  options?: { storage?: Pick<UpdateStorageAdapter, 'get'> }
): Promise<{ success: boolean; reloadTriggered: boolean; message: string; downloadUrl?: string }> {
  const repo = repository || SkillRepository.getInstance();
  const status = await getStoredUpdateStatus(options?.storage);

  if (status.status === 'downloading') {
    return {
      success: false,
      reloadTriggered: false,
      message:
        'Chrome is still downloading this update from the Chrome Web Store. Try again once it is ready.',
    };
  }

  if (!status.hasUpdate) {
    return {
      success: false,
      reloadTriggered: false,
      message: 'No update is ready to install.',
    };
  }

  // Create an automatic safety snapshot before updating
  await repo.createSafetyBackup('pre-update');

  const downloadUrl = status.downloadUrl || status.htmlUrl;

  if (
    status.status === 'ready_to_install' &&
    typeof chrome !== 'undefined' &&
    typeof chrome.runtime?.reload === 'function'
  ) {
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
 * Handles Chrome's native onUpdateAvailable event by marking status as ready to install
 * and enriching release notes from GitHub when available.
 *
 * @param details - The update details provided by Chrome runtime.
 * @param options - Optional repository, fetch, and storage overrides.
 */
export async function handleNativeUpdateAvailable(
  details: { version: string },
  options?: {
    repo?: string;
    fetchImpl?: typeof fetch;
    storage?: UpdateStorageAdapter;
  }
): Promise<void> {
  const currentVersion = getCurrentAppVersion();
  const latestVersion = stripVersionPrefix(details.version);
  const updateInfo: UpdateInfo = {
    currentVersion,
    latestVersion,
    hasUpdate: isUpdateAvailable(currentVersion, latestVersion),
    source: 'chrome_web_store',
    releaseName: `Skill Vault v${latestVersion}`,
    lastCheckedAt: Date.now(),
    status: 'ready_to_install',
  };
  await saveUpdateStatus(updateInfo, options?.storage);

  const repo = options?.repo || DEFAULT_GITHUB_REPO;
  const fetcher = options?.fetchImpl || (typeof fetch === 'function' ? fetch : undefined);
  if (!fetcher) {
    return;
  }

  const metadata = await fetchGitHubReleaseByTag(latestVersion, repo, fetcher);
  if (Object.keys(metadata).length > 0) {
    await saveUpdateStatus(
      {
        ...updateInfo,
        ...metadata,
      },
      options?.storage
    );
  }
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

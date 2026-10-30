// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Settings } from '../../src/sidepanel/components/Settings';
import { DEFAULT_SETTINGS, SkillVaultSettings, UpdateInfo } from '../../src/domain/types';

let root: Root;
let container: HTMLDivElement;

/**
 * Finds a button by its exact text content.
 *
 * @param text - The text inside the button.
 * @returns The matching button element or undefined.
 */
function findButton(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    b.textContent?.trim().includes(text)
  );
}

/**
 * Helper to mount the Settings component in the test container.
 *
 * @param props - Partial props to override test defaults.
 */
async function renderSettings(
  props: {
    settings?: SkillVaultSettings;
    updateInfo?: UpdateInfo | null;
    checkingUpdate?: boolean;
    applyingUpdate?: boolean;
    onCheckForUpdates?: () => Promise<void>;
    onApplyUpdate?: () => Promise<void>;
    onUpdateSettings?: (patch: Partial<SkillVaultSettings>) => Promise<void>;
  } = {}
) {
  const mergedSettings: SkillVaultSettings = props.settings || {
    ...DEFAULT_SETTINGS,
    autoCheckUpdates: true,
  };

  await act(async () => {
    root.render(
      <Settings
        geminiConfigured={false}
        onGeminiKeyChanged={vi.fn()}
        settings={mergedSettings}
        onUpdateSettings={props.onUpdateSettings || vi.fn().mockResolvedValue(undefined)}
        onExport={vi.fn()}
        onImport={vi.fn().mockResolvedValue(undefined)}
        updateInfo={props.updateInfo}
        checkingUpdate={props.checkingUpdate}
        applyingUpdate={props.applyingUpdate}
        onCheckForUpdates={props.onCheckForUpdates}
        onApplyUpdate={props.onApplyUpdate}
      />
    );
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('Settings Version and Updates UI', () => {
  /** Tests displaying the current version badge. */
  it('displays the current version badge in the card header', async () => {
    await renderSettings();
    expect(container.textContent).toContain('Version & Updates');
    expect(container.textContent).toContain('v0.1.4');
  });

  /** Tests displaying up to date status when no update is available. */
  it('shows up to date indicator when updateInfo is up_to_date', async () => {
    const updateInfo: UpdateInfo = {
      currentVersion: '0.1.4',
      hasUpdate: false,
      lastCheckedAt: Date.now(),
      status: 'up_to_date',
    };

    await renderSettings({ updateInfo });
    expect(container.textContent).toContain('Up to date');
    expect(container.textContent).toContain('Last checked:');
  });

  /** Tests displaying checking spinner when update check is active. */
  it('shows checking indicator during update check', async () => {
    await renderSettings({ checkingUpdate: true });
    expect(container.textContent).toContain('Checking...');
    expect(container.textContent).toContain('Checking for updates…');
  });

  /** Tests displaying update available details and triggering apply update. */
  it('shows release notes and update now button when update is available', async () => {
    const onApplyUpdate = vi.fn().mockResolvedValue(undefined);
    const updateInfo: UpdateInfo = {
      currentVersion: '0.1.4',
      latestVersion: '0.2.0',
      hasUpdate: true,
      releaseName: 'Skill Vault v0.2.0 Release',
      releaseNotes: 'Key improvements and auto updater support.',
      downloadUrl: 'https://example.com/download.zip',
      htmlUrl: 'https://example.com/release',
      lastCheckedAt: Date.now(),
      status: 'available',
    };

    await renderSettings({ updateInfo, onApplyUpdate });

    expect(container.textContent).toContain('Update available');
    expect(container.textContent).toContain('Skill Vault v0.2.0 Release');
    expect(container.textContent).toContain('Key improvements and auto updater support.');

    const updateBtn = findButton('Update now');
    expect(updateBtn).toBeDefined();

    await act(async () => {
      updateBtn?.click();
    });

    expect(onApplyUpdate).toHaveBeenCalled();
  });

  /** Tests clicking the check for updates button triggers callback. */
  it('triggers onCheckForUpdates when clicking Check for updates', async () => {
    const onCheckForUpdates = vi.fn().mockResolvedValue(undefined);
    await renderSettings({ onCheckForUpdates });

    const checkBtn = findButton('Check for updates');
    expect(checkBtn).toBeDefined();

    await act(async () => {
      checkBtn?.click();
    });

    expect(onCheckForUpdates).toHaveBeenCalled();
  });

  /** Tests toggling the automatic update check switch updates settings. */
  it('calls onUpdateSettings when toggling automatic check for updates switch', async () => {
    const onUpdateSettings = vi.fn().mockResolvedValue(undefined);
    await renderSettings({ onUpdateSettings });

    const switchBtn = container.querySelector<HTMLButtonElement>('#auto-check-updates');
    expect(switchBtn).toBeDefined();

    await act(async () => {
      switchBtn?.click();
    });

    expect(onUpdateSettings).toHaveBeenCalledWith({ autoCheckUpdates: false });
  });

  /** Tests displaying error status when update check fails. */
  it('displays check failed indicator when update check encountered an error', async () => {
    const updateInfo: UpdateInfo = {
      currentVersion: '0.1.4',
      hasUpdate: false,
      lastCheckedAt: Date.now(),
      status: 'error',
      errorMessage: 'Network timeout',
    };

    await renderSettings({ updateInfo });
    expect(container.textContent).toContain('Check failed');
  });
});

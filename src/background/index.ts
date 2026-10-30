import { setupCustomProviders } from './custom-providers';
import { SkillRepository } from '../infrastructure/storage/repository';
import { initContextMenu, setupContextMenuListener } from './context-menu';
import { setupMessageRouter } from './message-router';
import { setupTrashCleanup } from './trash-cleanup';
import { enqueueTask } from './task-queue';
import { setupAutoUpdater, checkForUpdates } from './updater';

/**
 * Handles extension installation or update events, setting up defaults and panel behavior.
 */
async function handleInstalledEvent(): Promise<void> {
  const repository = SkillRepository.getInstance();
  await enqueueTask(() => repository.init());
  initContextMenu();

  // Set sidepanel behavior if available (Chrome 116+)
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (err) {
      console.warn('[SkillVault] Could not configure sidePanel behavior:', err);
    }
  }

  // Trigger non-blocking update check if autoCheckUpdates is enabled
  try {
    const settings = await repository.getSettings();
    if (settings.autoCheckUpdates) {
      void checkForUpdates();
    }
  } catch (err) {
    console.warn('[SkillVault] Initial update check error:', err);
  }
}

/**
 * Handles browser startup events, re-initializing menus and scheduling update checks.
 */
async function handleStartupEvent(): Promise<void> {
  initContextMenu();

  try {
    const repository = SkillRepository.getInstance();
    const settings = await repository.getSettings();
    if (settings.autoCheckUpdates) {
      void checkForUpdates();
    }
  } catch (err) {
    console.warn('[SkillVault] Startup update check error:', err);
  }
}

// Initialize repository and default skills on install/update
chrome.runtime.onInstalled.addListener(handleInstalledEvent);

// Setup context menu and trigger update check on browser startup
chrome.runtime.onStartup.addListener(handleStartupEvent);

// Top-level listener registrations
// (CRITICAL for Manifest V3: listeners must be registered synchronously during script evaluation)
setupContextMenuListener();
setupMessageRouter();
setupTrashCleanup();
setupAutoUpdater();

// Ensure context menu item is registered
initContextMenu();

setupCustomProviders();

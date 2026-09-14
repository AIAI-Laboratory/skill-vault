import { SkillRepository } from '../infrastructure/storage/repository';
import { initContextMenu, setupContextMenuListener } from './context-menu';
import { setupMessageRouter } from './message-router';

// Initialize repository and default skills on install/update
chrome.runtime.onInstalled.addListener(async () => {
  const repository = SkillRepository.getInstance();
  await repository.init();
  initContextMenu();

  // Set sidepanel behavior if available (Chrome 116+)
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (err) {
      console.warn('[SkillVault] Could not configure sidePanel behavior:', err);
    }
  }
});

// Setup context menu on browser startup
chrome.runtime.onStartup.addListener(() => {
  initContextMenu();
});

// Top-level listener registrations
// (CRITICAL for Manifest V3: listeners must be registered synchronously during script evaluation)
setupContextMenuListener();
setupMessageRouter();

// Ensure context menu item is registered
initContextMenu();


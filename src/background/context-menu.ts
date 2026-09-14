export const CONTEXT_MENU_ID = 'save-selection-as-skill';

export interface DraftSkill {
  content: string;
  url: string;
  title: string;
  timestamp: number;
}

export function initContextMenu() {
  if (typeof chrome === 'undefined' || !chrome.contextMenus) return;

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Save selection as Skill',
      contexts: ['selection'],
    });
  });
}

export function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
) {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText) {
    return;
  }

  // 1. MUST be called synchronously to preserve the user gesture in Manifest V3
  if (typeof chrome !== 'undefined' && chrome.sidePanel && typeof chrome.sidePanel.open === 'function') {
    const windowId = tab?.windowId;
    const tabId = tab?.id;

    if (windowId) {
      chrome.sidePanel.open({ windowId }).catch((err) => {
        console.warn('[SkillVault] Failed to open sidePanel with windowId, trying tabId:', err);
        if (tabId) {
          chrome.sidePanel.open({ tabId }).catch((tabErr) => {
            console.warn('[SkillVault] Failed to open sidePanel with tabId:', tabErr);
          });
        }
      });
    } else if (tabId) {
      chrome.sidePanel.open({ tabId }).catch((err) => {
        console.warn('[SkillVault] Failed to open sidePanel with tabId:', err);
      });
    }
  }

  // 2. Persist draft in local storage for the side panel editor
  const draft: DraftSkill = {
    content: info.selectionText.trim(),
    url: info.pageUrl || tab?.url || '',
    title: tab?.title || '',
    timestamp: Date.now(),
  };

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.set({ 'draft:skill': draft }).catch((err) => {
      console.error('[SkillVault] Failed to save draft skill:', err);
    });
  }
}

export function setupContextMenuListener() {
  if (typeof chrome === 'undefined' || !chrome.contextMenus?.onClicked) return;
  chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
}

export function setupContextMenu() {
  initContextMenu();
  setupContextMenuListener();
}


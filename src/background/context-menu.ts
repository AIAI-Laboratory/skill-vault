import { processAndDetect, DraftSkill } from '../domain/template-detector';

export const CONTEXT_MENU_ID = 'save-selection-as-skill';

export type { DraftSkill };

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
  if (
    typeof chrome !== 'undefined' &&
    chrome.sidePanel &&
    typeof chrome.sidePanel.open === 'function'
  ) {
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

  // 2. Pre-process and detect template from highlighted selection
  const rawSelection = info.selectionText;
  const pageUrl = info.pageUrl || tab?.url || '';
  const pageTitle = tab?.title || '';

  const detection = processAndDetect(rawSelection, {
    url: pageUrl,
    title: pageTitle,
  });

  const draft: DraftSkill = {
    rawContent: rawSelection,
    content: detection.primaryTemplate.content,
    url: pageUrl,
    title: pageTitle,
    timestamp: Date.now(),
    detectedFormat: detection.formatInfo.format,
    formatLabel: detection.formatInfo.formatLabel,
    suggestedName: detection.primaryTemplate.name,
    suggestedShortcut: detection.primaryTemplate.shortcut,
    suggestedDescription: detection.primaryTemplate.description,
    suggestedTags: detection.primaryTemplate.tags,
    templateOptions: detection.templates,
    activeTemplateId: detection.primaryTemplate.id,
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

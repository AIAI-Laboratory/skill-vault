import { processAndDetect, slugify, DraftSkill, TemplateOption } from '../domain/template-detector';
import { readPageSelection } from '../content/selection';

export const CONTEXT_MENU_ID = 'save-selection-as-skill';

export type { DraftSkill };

let latestSelectionRequest = 0;

async function readFormattedSelection(tabId: number, frameId: number, fallback: string) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      func: readPageSelection,
      injectImmediately: true,
    });
    const selectedText = results[0]?.result;
    // The user may change selection or navigate while injection is pending.
    // Only accept the same text, differing in whitespace, from the clicked frame.
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    if (
      typeof selectedText === 'string' &&
      selectedText.trim() &&
      normalize(selectedText) === normalize(fallback)
    ) {
      return selectedText;
    }
  } catch {
    // Restricted pages and inaccessible frames cannot be scripted.
    // Retain the browser-provided selection when the original is unavailable.
  }
  return fallback;
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

export async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
) {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText) {
    return;
  }

  const requestId = ++latestSelectionRequest;
  // Start reading before opening the panel can move focus. Do not await here:
  // sidePanel.open must still run synchronously during the user gesture.
  const selectionRequest =
    tab?.id !== undefined &&
    typeof chrome !== 'undefined' &&
    typeof chrome.scripting?.executeScript === 'function'
      ? readFormattedSelection(tab.id, info.frameId ?? 0, info.selectionText)
      : undefined;

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

  // 2. Read the original selection before detecting metadata and storing a draft.
  const rawSelection = selectionRequest ? await selectionRequest : info.selectionText;
  if (requestId !== latestSelectionRequest) return;
  const pageUrl = info.pageUrl || tab?.url || '';
  const pageTitle = tab?.title || '';

  const detection = processAndDetect(rawSelection, {
    url: pageUrl,
    title: pageTitle,
  });

  // Saving a selection must never replace it with a generated instruction.
  // Keep detection useful for metadata and offer transformations as opt-in choices.
  const sourceName =
    detection.formatInfo.format === 'prompt'
      ? detection.primaryTemplate.name
      : rawSelection
          .trim()
          .split(/\r?\n/)[0]
          .replace(/^#+\s*/, '')
          .slice(0, 80);
  const originalTemplate: TemplateOption = {
    id: 'original_selection',
    label: 'Original Selection',
    name: sourceName || pageTitle || 'Saved Selection',
    shortcut:
      detection.formatInfo.format === 'prompt'
        ? detection.primaryTemplate.shortcut
        : slugify(sourceName || pageTitle || 'saved-selection', 32),
    description:
      detection.formatInfo.format === 'prompt' ? detection.primaryTemplate.description : '',
    content: rawSelection,
    tags: detection.formatInfo.format === 'prompt' ? detection.primaryTemplate.tags : ['snippet'],
    isPrimary: true,
  };

  const draft: DraftSkill = {
    rawContent: rawSelection,
    content: originalTemplate.content,
    url: pageUrl,
    title: pageTitle,
    timestamp: Date.now(),
    detectedFormat: detection.formatInfo.format,
    formatLabel: detection.formatInfo.formatLabel,
    suggestedName: originalTemplate.name,
    suggestedShortcut: originalTemplate.shortcut,
    suggestedDescription: originalTemplate.description,
    suggestedTags: originalTemplate.tags,
    templateOptions: [
      originalTemplate,
      ...detection.templates.map((template) => ({ ...template, isPrimary: false })),
    ],
    activeTemplateId: originalTemplate.id,
  };

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ 'draft:skill': draft }).catch((err) => {
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

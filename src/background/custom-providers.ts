import { BUILT_IN_ORIGINS, providerMatchPattern } from '../domain/custom-provider';
import { SkillRepository } from '../infrastructure/storage/repository';
import { enqueueTask } from './task-queue';

const SCRIPT_ID = 'custom-providers';

export async function syncCustomProviders(urls: string[]): Promise<void> {
  const matches: string[] = [];
  for (const pattern of new Set(urls.map(providerMatchPattern))) {
    if (await chrome.permissions.contains({ origins: [pattern] })) matches.push(pattern);
  }
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (!matches.length) {
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    return;
  }
  const script: chrome.scripting.RegisteredContentScript = {
    id: SCRIPT_ID,
    matches,
    excludeMatches: BUILT_IN_ORIGINS.map(providerMatchPattern),
    js: ['content.js'],
    runAt: 'document_idle',
    persistAcrossSessions: true,
  };
  if (existing.length) await chrome.scripting.updateContentScripts([script]);
  else await chrome.scripting.registerContentScripts([script]);
}

export function setupCustomProviders() {
  const refresh = () => {
    void enqueueTask(async () => {
      const settings = await SkillRepository.getInstance().getSettings();
      await syncCustomProviders(settings.customProviderUrls);
    }).catch((error) => console.warn('[SkillVault] Could not register custom providers:', error));
  };
  chrome.runtime.onInstalled.addListener(refresh);
  chrome.runtime.onStartup.addListener(refresh);
  chrome.permissions.onRemoved.addListener(refresh);
  chrome.permissions.onAdded.addListener(refresh);
}

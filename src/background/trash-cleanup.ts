import { SkillRepository } from '../infrastructure/storage/repository';
import { enqueueTask } from './task-queue';

export const TRASH_CLEANUP_ALARM = 'skill-vault:trash-cleanup';

// Call within the background task queue so cleanup cannot race with delete/restore.
export async function refreshTrashCleanup(repository: SkillRepository): Promise<void> {
  const trash = await repository.purgeExpiredTrash();
  if (trash.length === 0) {
    await chrome.alarms.clear(TRASH_CLEANUP_ALARM);
    return;
  }
  await chrome.alarms.create(TRASH_CLEANUP_ALARM, {
    when: Math.min(...trash.map((entry) => entry.expiresAt)),
    // Retry if a storage failure prevents cleanup on the first firing.
    periodInMinutes: 1,
  });
}

export function setupTrashCleanup(): void {
  const cleanup = () =>
    enqueueTask(() => refreshTrashCleanup(SkillRepository.getInstance())).catch((error) => {
      console.error('[SkillVault] Trash cleanup failed:', error);
    });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TRASH_CLEANUP_ALARM) void cleanup();
  });
  // Rebuild alarms and purge overdue entries whenever the service worker starts.
  void cleanup();
}

import { SkillRepository } from '../infrastructure/storage/repository';
import { ExtensionMessage, ExtensionResponse } from '../infrastructure/messaging/protocol';
import { enqueueTask } from './task-queue';
import { refreshTrashCleanup } from './trash-cleanup';

export function setupMessageRouter() {
  const repository = SkillRepository.getInstance();

  chrome.runtime.onMessage.addListener((msg: ExtensionMessage, _sender, sendResponse) => {
    if (!msg || !msg.type) {
      return false;
    }

    enqueueTask(() => handleMessage(msg, repository))
      .then((data) => {
        const response: ExtensionResponse = {
          id: msg.id,
          ok: true,
          data,
        };
        sendResponse(response);
      })
      .catch((err: any) => {
        console.error(`[SkillVault][MessageRouter] Error handling ${msg.type}:`, err);
        const response: ExtensionResponse = {
          id: msg.id,
          ok: false,
          error: err?.message || 'Internal error',
        };
        sendResponse(response);
      });

    // Return true to indicate asynchronous response
    return true;
  });
}

async function handleMessage(msg: ExtensionMessage, repository: SkillRepository): Promise<any> {
  switch (msg.type) {
    case 'SKILL_SEARCH': {
      const query = msg.payload?.query || '';
      return await repository.search(query);
    }
    case 'SKILL_LIST': {
      return await repository.list();
    }
    case 'SKILL_GET': {
      const id = msg.payload?.id;
      if (!id) throw new Error('Skill ID is required');
      return await repository.get(id);
    }
    case 'SKILL_CREATE': {
      return await repository.create(msg.payload);
    }
    case 'SKILL_UPDATE': {
      const { id, patch } = msg.payload || {};
      if (!id) throw new Error('Skill ID is required');
      return await repository.update(id, patch);
    }
    case 'SKILL_DELETE': {
      const id = msg.payload?.id;
      if (!id) throw new Error('Skill ID is required');
      await repository.remove(id);
      await refreshTrashCleanup(repository);
      return true;
    }
    case 'SKILL_TRASH_LIST': {
      return await repository.listTrash();
    }
    case 'SKILL_RESTORE': {
      const id = msg.payload?.id;
      if (!id) throw new Error('Skill ID is required');
      const skill = await repository.restore(id);
      await refreshTrashCleanup(repository);
      return skill;
    }
    case 'SKILL_RECORD_USAGE': {
      const id = msg.payload?.id;
      if (!id) throw new Error('Skill ID is required');
      await repository.recordUsage(id);
      return true;
    }
    case 'SETTINGS_GET': {
      return await repository.getSettings();
    }
    case 'SETTINGS_UPDATE': {
      return await repository.updateSettings(msg.payload);
    }
    case 'GET_DRAFT_SKILL': {
      const data = await chrome.storage.local.get('draft:skill');
      return data['draft:skill'] || null;
    }
    case 'CLEAR_DRAFT_SKILL': {
      await chrome.storage.local.remove('draft:skill');
      return true;
    }
    default:
      throw new Error(`Unknown message type: ${msg.type}`);
  }
}

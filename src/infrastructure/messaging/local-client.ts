import { enqueueTask } from '../../background/task-queue';
import { SkillRepository } from '../storage/repository';
import type { ExtensionMessage, MessageResponseMap, MessageType } from './protocol';

// Development preview uses the repository's localStorage backend, without Chrome APIs.
export function sendLocalMessage<K extends MessageType>(
  message: ExtensionMessage
): Promise<MessageResponseMap[K]> {
  return enqueueTask(async () => {
    const repository = SkillRepository.getInstance();
    await repository.init();
    const { type, payload } = message;
    switch (type) {
      case 'SKILL_LIST':
        return repository.list();
      case 'SKILL_IMPORT':
        return repository.importJson(payload.json);
      case 'SKILL_SEARCH':
        return repository.search(payload.query);
      case 'SKILL_GET':
        return repository.get(payload.id);
      case 'SKILL_CREATE':
        return repository.create(payload);
      case 'SKILL_UPDATE':
        return repository.update(payload.id, payload.patch);
      case 'SKILL_DELETE':
        await repository.remove(payload.id);
        return true;
      case 'SKILL_TRASH_LIST':
        return repository.listTrash();
      case 'SKILL_RESTORE':
        return repository.restore(payload.id);
      case 'SKILL_RECORD_USAGE':
        await repository.recordUsage(payload.id);
        return true;
      case 'SETTINGS_GET':
        return repository.getSettings();
      case 'SETTINGS_UPDATE':
        return repository.updateSettings(payload);
      case 'GET_DRAFT_SKILL':
        return null;
      case 'CLEAR_DRAFT_SKILL':
        return true;
      default:
        throw new Error(`${type} requires the Skill Vault extension`);
    }
  }) as Promise<MessageResponseMap[K]>;
}

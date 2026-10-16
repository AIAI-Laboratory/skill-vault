import type { Skill } from '../domain/types';

export const SKILL_DRAG_TYPE = 'application/x-skill-vault-id';

export function getSkillLabel(skill: Skill): string {
  return skill.shortcut ? `🏷️ /${skill.shortcut}` : `🏷️ ${skill.name}`;
}

export function writeSkillDragData(transfer: DataTransfer, skill: Skill) {
  transfer.effectAllowed = 'copy';
  transfer.setData(SKILL_DRAG_TYPE, skill.id);
  transfer.setData('text/plain', getSkillLabel(skill));
}

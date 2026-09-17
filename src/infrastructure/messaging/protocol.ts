import {
  Skill,
  CreateSkillInput,
  UpdateSkillInput,
  SkillSearchResult,
  SkillVaultSettings,
  TrashedSkill,
} from '../../domain/types';
import type { DraftSkill } from '../../domain/template-detector';

export type MessageType =
  | 'SKILL_SEARCH'
  | 'SKILL_LIST'
  | 'SKILL_GET'
  | 'SKILL_CREATE'
  | 'SKILL_UPDATE'
  | 'SKILL_DELETE'
  | 'SKILL_TRASH_LIST'
  | 'SKILL_RESTORE'
  | 'SKILL_RECORD_USAGE'
  | 'SETTINGS_GET'
  | 'SETTINGS_UPDATE'
  | 'GET_DRAFT_SKILL'
  | 'CLEAR_DRAFT_SKILL'
  | 'OPEN_SIDE_PANEL';

export interface ExtensionMessage<T = any> {
  id: string;
  version: 1;
  type: MessageType;
  payload: T;
}

export interface ExtensionResponse<T = any> {
  id: string;
  ok: boolean;
  data?: T;
  error?: string;
}

// Payload & Response mappings
export interface MessagePayloadMap {
  SKILL_SEARCH: { query: string };
  SKILL_LIST: undefined;
  SKILL_GET: { id: string };
  SKILL_CREATE: CreateSkillInput;
  SKILL_UPDATE: { id: string; patch: UpdateSkillInput };
  SKILL_DELETE: { id: string };
  SKILL_TRASH_LIST: undefined;
  SKILL_RESTORE: { id: string };
  SKILL_RECORD_USAGE: { id: string };
  SETTINGS_GET: undefined;
  SETTINGS_UPDATE: Partial<SkillVaultSettings>;
  GET_DRAFT_SKILL: undefined;
  CLEAR_DRAFT_SKILL: undefined;
  OPEN_SIDE_PANEL: undefined;
}

export interface MessageResponseMap {
  SKILL_SEARCH: SkillSearchResult[];
  SKILL_LIST: Skill[];
  SKILL_GET: Skill | null;
  SKILL_CREATE: Skill;
  SKILL_UPDATE: Skill;
  SKILL_DELETE: boolean;
  SKILL_TRASH_LIST: TrashedSkill[];
  SKILL_RESTORE: Skill;
  SKILL_RECORD_USAGE: boolean;
  SETTINGS_GET: SkillVaultSettings;
  SETTINGS_UPDATE: SkillVaultSettings;
  GET_DRAFT_SKILL: DraftSkill | null;
  CLEAR_DRAFT_SKILL: boolean;
  OPEN_SIDE_PANEL: boolean;
}

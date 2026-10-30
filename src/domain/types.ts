export interface SkillVariable {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  required: boolean;
  defaultValue?: string;
  options?: string[];
}

export interface ProviderRule {
  provider: string;
  enabled: boolean;
  customPrefix?: string;
  customSuffix?: string;
}

export interface SkillUsage {
  count: number;
  lastUsedAt?: string;
}

export interface Skill {
  id: string;
  schemaVersion: number;
  name: string;
  description?: string;
  shortcut?: string;
  content: string;
  tags: string[];
  favorite: boolean;
  variables: SkillVariable[];
  providers?: ProviderRule[];
  createdAt: string;
  updatedAt: string;
  usage: SkillUsage;
}

export type CreateSkillInput = Omit<
  Skill,
  'id' | 'schemaVersion' | 'createdAt' | 'updatedAt' | 'usage'
> & {
  id?: string;
};

export type UpdateSkillInput = Partial<Omit<Skill, 'id' | 'createdAt' | 'schemaVersion'>>;

export interface TrashedSkill {
  skill: Skill;
  deletedAt: number;
  expiresAt: number;
}

export interface SkillSearchResult {
  skill: Skill;
  score: number;
}

export interface SkillVaultSettings {
  customProviderUrls: string[];
  disabledCustomProviderUrls: string[];
  enableChatGPT: boolean;
  enableClaude: boolean;
  enableGemini: boolean;
  enableDirectShortcuts: boolean;
  autoCheckUpdates: boolean;
  theme: 'dark' | 'light' | 'system';
}

export const DEFAULT_SETTINGS: SkillVaultSettings = {
  customProviderUrls: [],
  disabledCustomProviderUrls: [],
  enableChatGPT: true,
  enableClaude: true,
  enableGemini: true,
  enableDirectShortcuts: false,
  autoCheckUpdates: true,
  theme: 'dark',
};

/** Status representation of the update checking lifecycle. */
export type UpdateCheckStatus =
  'idle' | 'checking' | 'available' | 'up_to_date' | 'ready_to_install' | 'error';

/** Information describing the current update status and prospective releases. */
export interface UpdateInfo {
  currentVersion: string;
  latestVersion?: string;
  hasUpdate: boolean;
  releaseName?: string;
  releaseNotes?: string;
  publishedAt?: string;
  downloadUrl?: string;
  htmlUrl?: string;
  lastCheckedAt: number;
  status: UpdateCheckStatus;
  errorMessage?: string;
}

export interface PageContext {
  url: string;
  hostname: string;
  title: string;
  selectedText?: string;
}

export interface DraftSkill {
  rawContent?: string;
  content: string;
  url?: string;
  title?: string;
  timestamp?: number;
  suggestedName?: string;
  suggestedShortcut?: string;
  suggestedDescription?: string;
  suggestedTags?: string[];
}

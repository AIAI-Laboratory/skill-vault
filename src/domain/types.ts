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

export interface SkillSearchResult {
  skill: Skill;
  score: number;
}

export interface SkillVaultSettings {
  enableChatGPT: boolean;
  enableClaude: boolean;
  enableGemini: boolean;
  showFavoritesFirst: boolean;
  enableDirectShortcuts: boolean;
  theme: 'dark' | 'light' | 'system';
}

export const DEFAULT_SETTINGS: SkillVaultSettings = {
  enableChatGPT: true,
  enableClaude: true,
  enableGemini: true,
  showFavoritesFirst: true,
  enableDirectShortcuts: false,
  theme: 'dark',
};

export interface PageContext {
  url: string;
  hostname: string;
  title: string;
  selectedText?: string;
}

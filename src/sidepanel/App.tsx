import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Settings as SettingsIcon,
  AlertCircle,
  Layers3,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster, toast } from '@/components/ui/toast';
import {
  Skill,
  TrashedSkill,
  CreateSkillInput,
  SkillVaultSettings,
  DEFAULT_SETTINGS,
} from '../domain/types';
import { DraftSkill } from '../domain/types';
import { sendExtensionMessage } from '../infrastructure/messaging/client';
import { SkillRepository } from '../infrastructure/storage/repository';
import { SearchBar } from './components/SearchBar';
import { SkillList } from './components/SkillList';
import { SkillEditor } from './components/SkillEditor';
import { Settings } from './components/Settings';
import { TrashList } from './components/TrashList';

type ActiveTab = 'all' | 'trash' | 'settings';

export const App: React.FC = () => {
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [trash, setTrash] = useState<TrashedSkill[]>([]);
  const [settings, setSettings] = useState<SkillVaultSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  // Draft text from right-click context menu
  const [draftSkill, setDraftSkill] = useState<DraftSkill | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const showToast = (title: string) => {
    toast.add({ title });
  };

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      document.documentElement.classList.toggle(
        'dark',
        settings.theme === 'dark' || (settings.theme === 'system' && media.matches)
      );
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);

  const loadSkills = async () => {
    try {
      const list = await sendExtensionMessage('SKILL_LIST');
      setSkills(list);
      setLoadError(null);
    } catch (err) {
      console.error('Failed to load skills:', err);
      setLoadError(
        'Could not connect to your vault. Open this panel from the Skill Vault extension and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadGeminiStatus = async () => {
    try {
      setGeminiConfigured(Boolean(await SkillRepository.getInstance().getGeminiApiKey()));
    } catch {
      setGeminiConfigured(false);
    }
  };

  const loadSettings = async () => {
    try {
      const s = await sendExtensionMessage('SETTINGS_GET');
      setSettings(s);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const loadTrash = async () => {
    try {
      setTrash(await sendExtensionMessage('SKILL_TRASH_LIST'));
    } catch (err) {
      console.error('Failed to load trash:', err);
    }
  };

  const checkDraftSkill = async () => {
    try {
      const draft = await sendExtensionMessage('GET_DRAFT_SKILL');
      if (draft && draft.content) {
        setDraftSkill(draft);
        // Automatically open the editor if the draft was created recently (< 15 mins ago)
        const isRecent = !draft.timestamp || Date.now() - draft.timestamp < 15 * 60 * 1000;
        if (isRecent) {
          setEditingSkill(null);
          setIsEditing(true);
        }
      }
    } catch (err) {
      console.warn('Could not check draft skill:', err);
    }
  };

  useEffect(() => {
    loadSkills();
    loadTrash();
    loadSettings();
    void loadGeminiStatus();
    checkDraftSkill();

    // Periodic check or storage listener for draft skill
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
        if (changes['draft:skill']?.newValue) {
          const newDraft = changes['draft:skill'].newValue;
          setDraftSkill(newDraft);
          // New draft arrived from context menu! Open editor immediately with draft
          setEditingSkill(null);
          setIsEditing(true);
        } else if (changes['draft:skill'] && !changes['draft:skill'].newValue) {
          setDraftSkill(null);
        }
        if (changes['credentials:gemini']) void loadGeminiStatus();
        if (changes['skill:index']) {
          loadSkills();
        }
        if (changes['skill:trash']) {
          loadTrash();
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'trash') return;
    const interval = setInterval(() => void loadTrash(), 30_000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Put the most-used tags first so the quick filters stay useful.
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const skill of skills) {
      for (const t of skill.tags || []) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return Array.from(counts.keys()).sort(
      (a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b)
    );
  }, [skills]);

  // Filter skills based on tab, search, and tag
  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      // Tab filter
      if (favoritesOnly && !skill.favorite) {
        return false;
      }

      // Tag filter
      if (selectedTag && !skill.tags.includes(selectedTag)) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase().replace(/^\//, '');
        const matchName = skill.name.toLowerCase().includes(q);
        const matchDesc = (skill.description || '').toLowerCase().includes(q);
        const matchTag = skill.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchDesc && !matchTag) {
          return false;
        }
      }

      return true;
    });
  }, [skills, favoritesOnly, selectedTag, searchQuery]);

  // Save or update skill
  const handleSaveSkill = async (skillData: CreateSkillInput, id?: string) => {
    if (id) {
      await sendExtensionMessage('SKILL_UPDATE', { id, patch: skillData });
      showToast(`Updated "${skillData.name}"`);
    } else {
      await sendExtensionMessage('SKILL_CREATE', skillData);
      showToast(`Created "${skillData.name}"`);
    }
    setIsEditing(false);
    setEditingSkill(null);
    await loadSkills();
  };

  // Delete skill
  const handleDeleteSkill = async (id: string) => {
    try {
      await sendExtensionMessage('SKILL_DELETE', { id });
      showToast('Moved to trash. Automatically deleted after 24 hours.');
      await Promise.all([loadSkills(), loadTrash()]);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete');
    }
  };

  const handleRestoreSkill = async (entry: TrashedSkill) => {
    try {
      const restored = await sendExtensionMessage('SKILL_RESTORE', { id: entry.skill.id });
      showToast(
        entry.skill.shortcut && !restored.shortcut
          ? 'Skill restored without its shortcut because it is already in use.'
          : 'Skill restored'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to restore');
    }
    await Promise.all([loadSkills(), loadTrash()]);
  };

  // Toggle favorite
  const handleToggleFavorite = async (id: string, current: boolean) => {
    try {
      await sendExtensionMessage('SKILL_UPDATE', { id, patch: { favorite: !current } });
      await loadSkills();
    } catch (err: any) {
      showToast(err.message || 'Failed to update favorite');
    }
  };

  // Start creating from draft
  const handleUseDraft = () => {
    setEditingSkill(null);
    setIsEditing(true);
  };

  const handleDismissDraft = async () => {
    await sendExtensionMessage('CLEAR_DRAFT_SKILL');
    setDraftSkill(null);
  };

  // Export JSON backup
  const handleExport = () => {
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      skills,
      settings,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill-vault-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Vault backup downloaded!');
  };

  // Import JSON backup
  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const skillsToImport: any[] = Array.isArray(parsed) ? parsed : parsed.skills;

      if (!Array.isArray(skillsToImport)) {
        throw new Error('Invalid backup file: no skills found.');
      }

      let count = 0;
      for (const item of skillsToImport) {
        try {
          if (item.id) {
            await sendExtensionMessage('SKILL_CREATE', item);
            count++;
          }
        } catch {
          // ignore duplicate shortcut or id errors during batch import
        }
      }

      await loadSkills();
      showToast(`Imported ${count} skills!`);
    } catch (err: any) {
      showToast(err.message || 'Import failed');
    }
  };

  const createSkill = () => {
    setEditingSkill(null);
    setIsEditing(true);
  };
  const hasFilters = Boolean(searchQuery.trim() || selectedTag || favoritesOnly);
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTag(null);
    setFavoritesOnly(false);
  };

  const searchBar = (
    <SearchBar
      value={searchQuery}
      onChange={setSearchQuery}
      tags={allTags}
      selectedTag={selectedTag}
      onSelectTag={setSelectedTag}
      favoritesOnly={favoritesOnly}
      onToggleFavorites={() => setFavoritesOnly((value) => !value)}
    />
  );

  const library = (
    <div className="flex flex-col gap-6">
      <span className="sr-only" aria-live="polite">
        {filteredSkills.length} {filteredSkills.length === 1 ? 'skill' : 'skills'}
        {hasFilters ? ' found' : ''}
      </span>
      <SkillList
        skills={filteredSkills}
        searchQuery={searchQuery}
        onEdit={(skill) => {
          setEditingSkill(skill);
          setIsEditing(true);
        }}
        onDelete={handleDeleteSkill}
        onToggleFavorite={handleToggleFavorite}
        onShowToast={showToast}
        onCreateNew={createSkill}
        hasFilters={hasFilters}
        favoritesOnly={favoritesOnly}
        onClearFilters={clearFilters}
      />
    </div>
  );

  return (
    <TooltipProvider delay={300}>
      <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-2xl flex-col overflow-x-clip">
        <div className="sticky top-0 z-30 bg-background">
          <header className="flex items-center justify-between gap-3 px-4 py-3">
            <button
              type="button"
              className="flex min-w-0 select-none items-center gap-2.5 rounded-md text-left"
              aria-label="Vault"
              onClick={() => setActiveTab('all')}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Layers3 className="size-[18px]" />
              </div>
              <p className="text-base font-semibold tracking-tight">Skill Vault</p>
            </button>
            {!isEditing && (
              <Button onClick={createSkill}>
                <Plus data-icon="inline-start" />
                New skill
              </Button>
            )}
          </header>
          <Separator />
          {!isEditing && (
            <nav className="px-4 py-3" aria-label="Vault navigation">
              <div className="flex h-12 w-full gap-1 rounded-xl bg-muted p-1.5">
                <button
                  type="button"
                  aria-current={activeTab === 'all' ? 'page' : undefined}
                  className={`flex min-w-0 flex-1 select-none items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}`}
                  onClick={() => setActiveTab('all')}
                >
                  <BookOpen className="size-[18px]" />
                  Vault
                </button>
                <button
                  type="button"
                  aria-current={activeTab === 'trash' ? 'page' : undefined}
                  className={`flex min-w-0 flex-1 select-none items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors ${activeTab === 'trash' ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}`}
                  onClick={() => {
                    setActiveTab('trash');
                    void loadTrash();
                  }}
                >
                  <Trash2 className="size-[18px]" />
                  Trash
                </button>
                <button
                  type="button"
                  aria-current={activeTab === 'settings' ? 'page' : undefined}
                  className={`flex min-w-0 flex-1 select-none items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}`}
                  onClick={() => setActiveTab('settings')}
                >
                  <SettingsIcon className="size-[18px]" />
                  Settings
                </button>
              </div>
            </nav>
          )}
          {!isEditing && activeTab === 'all' && <div className="px-5 pb-3">{searchBar}</div>}
        </div>
        {isEditing ? (
          <main className="flex-1 p-5">
            <SkillEditor
              key={
                editingSkill?.id ||
                (draftSkill ? `draft-${draftSkill.timestamp || draftSkill.content}` : 'new')
              }
              geminiConfigured={geminiConfigured}
              onGeminiKeyChanged={setGeminiConfigured}
              initialSkill={editingSkill}
              initialDraftContent={!editingSkill ? draftSkill?.content : undefined}
              draftSkill={!editingSkill ? draftSkill : null}
              draftMeta={
                !editingSkill && draftSkill
                  ? { title: draftSkill.title, url: draftSkill.url }
                  : null
              }
              onSave={async (data, id) => {
                await handleSaveSkill(data, id);
                if (draftSkill) await handleDismissDraft();
              }}
              onCancel={async () => {
                setIsEditing(false);
                setEditingSkill(null);
                if (draftSkill) await handleDismissDraft();
              }}
            />
          </main>
        ) : (
          <main className="flex flex-1 flex-col px-5 pt-5 pb-6">
            {draftSkill && (
              <Alert className="mb-5">
                <AlertCircle />
                <AlertTitle>Turn your selection into a skill</AlertTitle>
                <AlertDescription>
                  <p>Content saved and ready to use.</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleUseDraft}>
                      Create skill
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleDismissDraft}>
                      Dismiss
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {loadError && (
              <Alert variant="destructive" className="mb-5">
                <AlertCircle />
                <AlertTitle>Vault unavailable</AlertTitle>
                <AlertDescription>
                  {loadError}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-fit"
                    onClick={() => void loadSkills()}
                  >
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {activeTab === 'all' &&
              (loading ? (
                <div className="flex flex-col gap-4" role="status" aria-label="Loading skills">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-36 w-full" />
                  <Skeleton className="h-36 w-full" />
                </div>
              ) : (
                library
              ))}
            {activeTab === 'trash' && <TrashList entries={trash} onRestore={handleRestoreSkill} />}
            {activeTab === 'settings' && (
              <Settings
                geminiConfigured={geminiConfigured}
                onGeminiKeyChanged={setGeminiConfigured}
                settings={settings}
                onUpdateSettings={async (patch) => {
                  try {
                    const updated = await sendExtensionMessage('SETTINGS_UPDATE', patch);
                    setSettings(updated);
                    showToast('Settings saved');
                  } catch (err) {
                    showToast(err instanceof Error ? err.message : 'Could not save settings');
                    throw err;
                  }
                }}
                onExport={handleExport}
                onImport={handleImport}
              />
            )}
          </main>
        )}
      </div>
      <Toaster />
    </TooltipProvider>
  );
};

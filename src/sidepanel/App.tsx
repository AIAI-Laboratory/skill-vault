import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  BookOpen,
  Star,
  Trash2,
  Settings as SettingsIcon,
  AlertCircle,
  Layers3,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { DraftSkill } from '../domain/template-detector';
import { sendExtensionMessage } from '../infrastructure/messaging/client';
import { SearchBar } from './components/SearchBar';
import { SkillList } from './components/SkillList';
import { SkillEditor } from './components/SkillEditor';
import { Settings } from './components/Settings';
import { TrashList } from './components/TrashList';

type ActiveTab = 'all' | 'favorites' | 'trash' | 'settings';

export const App: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [trash, setTrash] = useState<TrashedSkill[]>([]);
  const [settings, setSettings] = useState<SkillVaultSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
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

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const skill of skills) {
      for (const t of skill.tags || []) {
        tagSet.add(t);
      }
    }
    return Array.from(tagSet).sort();
  }, [skills]);

  // Filter skills based on tab, search, and tag
  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      // Tab filter
      if (activeTab === 'favorites' && !skill.favorite) {
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
        const matchShortcut = (skill.shortcut || '').toLowerCase().includes(q);
        const matchDesc = (skill.description || '').toLowerCase().includes(q);
        const matchContent = skill.content.toLowerCase().includes(q);
        const matchTag = skill.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchShortcut && !matchDesc && !matchContent && !matchTag) {
          return false;
        }
      }

      return true;
    });
  }, [skills, activeTab, selectedTag, searchQuery]);

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
  const hasFilters = Boolean(searchQuery.trim() || selectedTag);
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTag(null);
  };

  const library = (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
            Your prompt workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {activeTab === 'favorites' ? 'The go-to collection.' : 'Good prompts. On repeat.'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeTab === 'favorites'
              ? 'Your favorite skills, one step closer.'
              : 'Save what works. Make it work everywhere.'}
          </p>
        </div>
      </div>
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        tags={allTags}
        selectedTag={selectedTag}
        onSelectTag={setSelectedTag}
      />
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{activeTab === 'favorites' ? 'FAVORITE SKILLS' : 'YOUR LIBRARY'}</span>
        <span aria-live="polite">
          {filteredSkills.length} {filteredSkills.length === 1 ? 'skill' : 'skills'}
          {hasFilters ? ' found' : ''}
        </span>
      </div>
      <SkillList
        skills={filteredSkills}
        onEdit={(skill) => {
          setEditingSkill(skill);
          setIsEditing(true);
        }}
        onDelete={handleDeleteSkill}
        onToggleFavorite={handleToggleFavorite}
        onShowToast={showToast}
        onCreateNew={createSkill}
        hasFilters={hasFilters}
        favoritesOnly={activeTab === 'favorites'}
        onClearFilters={clearFilters}
      />
    </div>
  );

  return (
    <TooltipProvider delay={300}>
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
        <header className="flex items-center justify-between gap-3 px-5 py-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Layers3 className="size-5" />
            </div>
            <div>
              <p className="font-semibold tracking-tight">Skill Vault</p>
              <p className="text-[11px] text-muted-foreground">
                A little library. A lot of possibility.
              </p>
            </div>
          </div>
          {!isEditing && (
            <Button onClick={createSkill}>
              <Plus data-icon="inline-start" />
              New skill
            </Button>
          )}
        </header>
        <Separator />
        {isEditing ? (
          <main className="flex-1 p-5">
            <SkillEditor
              key={
                editingSkill?.id ||
                (draftSkill ? `draft-${draftSkill.timestamp || draftSkill.content}` : 'new')
              }
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
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as ActiveTab);
              if (value === 'trash') void loadTrash();
            }}
            className="flex-1 gap-0"
          >
            <nav className="px-4 py-3" aria-label="Vault navigation">
              <TabsList className="w-full">
                <TabsTrigger value="all">
                  <BookOpen />
                  Vault<Badge variant="secondary">{skills.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="favorites">
                  <Star />
                  Favorites
                </TabsTrigger>
                <TabsTrigger value="trash" aria-label={`Trash, ${trash.length} skills`}>
                  <Trash2 />
                  Trash
                </TabsTrigger>
                <TabsTrigger value="settings" aria-label="Settings">
                  <SettingsIcon />
                  <span className="sr-only min-[380px]:not-sr-only">Settings</span>
                </TabsTrigger>
              </TabsList>
            </nav>
            <main className="flex flex-1 flex-col px-5 pt-3 pb-6">
              {draftSkill && (
                <Alert className="mb-5">
                  <AlertCircle />
                  <AlertTitle>Turn your selection into a skill</AlertTitle>
                  <AlertDescription>
                    <p>{draftSkill.formatLabel || 'Content'} saved and ready to use.</p>
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
              <TabsContent value="all">
                {loading ? (
                  <div className="flex flex-col gap-4" role="status" aria-label="Loading skills">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-36 w-full" />
                    <Skeleton className="h-36 w-full" />
                  </div>
                ) : (
                  library
                )}
              </TabsContent>
              <TabsContent value="favorites">{library}</TabsContent>
              <TabsContent value="trash">
                <TrashList entries={trash} onRestore={handleRestoreSkill} />
              </TabsContent>
              <TabsContent value="settings">
                <Settings
                  settings={settings}
                  skills={skills}
                  onUpdateSettings={async (patch) => {
                    try {
                      const updated = await sendExtensionMessage('SETTINGS_UPDATE', patch);
                      setSettings(updated);
                      showToast('Settings saved');
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Could not save settings');
                    }
                  }}
                  onExport={handleExport}
                  onImport={handleImport}
                />
              </TabsContent>
            </main>
          </Tabs>
        )}
        <footer className="mt-auto px-5 pb-4">
          <Separator className="mb-3" />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" />
              Local. Private. Yours.
            </span>
            <span className="flex items-center gap-1.5">
              <Terminal className="size-3.5" />
              Type <code className="text-foreground">/skill</code> in your AI chat
            </span>
          </div>
        </footer>
      </div>
      <Toaster />
    </TooltipProvider>
  );
};

import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Settings as SettingsIcon,
  AlertCircle,
  Layers3,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Toaster, toast, type ToastTone } from '@/components/ui/toast';
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
import {
  DEFAULT_COLLECTIONS,
  getSkillCollection,
  sortSkills,
  matchesSkillSearch,
  type SkillSort,
} from '../domain/library';
import { SearchBar } from './components/SearchBar';
import { SkillList } from './components/SkillList';
import { SkillEditor } from './components/SkillEditor';
import { Settings } from './components/Settings';
import { TrashList } from './components/TrashList';

type ActiveTab = 'all' | 'trash' | 'settings';
const PAGE_SIZES = [5, 10, 20, 50];

export const App: React.FC = () => {
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [trash, setTrash] = useState<TrashedSkill[]>([]);
  const [settings, setSettings] = useState<SkillVaultSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [view, setView] = useState('all');
  const [sort, setSort] = useState<SkillSort>('newest');
  const [duplicateSkill, setDuplicateSkill] = useState<Skill | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  // Draft text from right-click context menu
  const [draftSkill, setDraftSkill] = useState<DraftSkill | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const showToast = (title: string, type: ToastTone = 'success') => {
    toast.add({ title, type });
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
          setDuplicateSkill(null);
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
          setDuplicateSkill(null);
          setIsEditing(true);
        } else if (changes['draft:skill'] && !changes['draft:skill'].newValue) {
          setDraftSkill(null);
        }
        if (changes['credentials:gemini']) void loadGeminiStatus();
        if (Object.keys(changes).some((key) => key.startsWith('skill:') && key !== 'skill:trash')) {
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

  const collections = useMemo(
    () => [...new Set([...DEFAULT_COLLECTIONS, ...skills.map(getSkillCollection).filter(Boolean)])],
    [skills]
  );

  // Filter the complete vault before sorting and pagination.
  const filteredSkills = useMemo(() => {
    const filtered = skills.filter((skill) => {
      if (view === 'recent' && !skill.usage.lastUsedAt) return false;
      if (
        view.startsWith('collection:') &&
        getSkillCollection(skill) !== view.slice('collection:'.length)
      )
        return false;
      // Tab filter
      if (favoritesOnly && !skill.favorite) {
        return false;
      }

      if (!selectedTags.every((tag) => skill.tags.includes(tag))) return false;
      if (!matchesSkillSearch(skill, searchQuery)) return false;

      return true;
    });
    return sortSkills(filtered, view === 'recent' ? 'recent' : sort);
  }, [skills, favoritesOnly, selectedTags, searchQuery, view, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredSkills.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  // Keep the last page valid after deleting a skill or refreshing the vault.
  if (page !== currentPage) setPage(currentPage);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleSkills = filteredSkills.slice(pageStart, pageStart + pageSize);
  const changePage = (nextPage: number) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Save or update skill
  const handleSaveSkill = async (skillData: CreateSkillInput, id?: string) => {
    if (id) {
      await sendExtensionMessage('SKILL_UPDATE', { id, patch: skillData });
      showToast(`Updated "${skillData.name}"`);
    } else {
      await sendExtensionMessage('SKILL_CREATE', skillData);
      setPage(1);
      setSort('newest');
      clearFilters();
      showToast(`Created "${skillData.name}"`);
    }
    setIsEditing(false);
    setEditingSkill(null);
    setDuplicateSkill(null);
    await loadSkills();
  };

  // Delete skill
  const handleDeleteSkill = async (id: string) => {
    try {
      await sendExtensionMessage('SKILL_DELETE', { id });
      const updatedTrash = await sendExtensionMessage('SKILL_TRASH_LIST');
      setTrash(updatedTrash);
      await loadSkills();
      const entry = updatedTrash.find((item) => item.skill.id === id);
      const toastId = toast.add({
        title: 'Skill moved to trash',
        type: 'info',
        description: 'Automatically deleted after 24 hours.',
        timeout: 8000,
        actionProps: entry
          ? {
              children: 'Undo',
              onClick: () => {
                toast.close(toastId);
                void handleRestoreSkill(entry);
              },
            }
          : undefined,
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error');
    }
  };

  const handleRestoreSkill = async (entry: TrashedSkill) => {
    try {
      const restored = await sendExtensionMessage('SKILL_RESTORE', { id: entry.skill.id });
      showToast(
        entry.skill.shortcut && !restored.shortcut
          ? 'Skill restored without its shortcut because it is already in use.'
          : 'Skill restored',
        entry.skill.shortcut && !restored.shortcut ? 'warning' : 'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to restore', 'error');
    }
    await Promise.all([loadSkills(), loadTrash()]);
  };

  // Toggle favorite
  const handleToggleFavorite = async (id: string, current: boolean) => {
    try {
      await sendExtensionMessage('SKILL_UPDATE', { id, patch: { favorite: !current } });
      await loadSkills();
    } catch (err: any) {
      showToast(err.message || 'Failed to update favorite', 'error');
    }
  };

  // Start creating from draft
  const handleUseDraft = () => {
    setEditingSkill(null);
    setDuplicateSkill(null);
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
      const result = await sendExtensionMessage('SKILL_IMPORT', { json: await file.text() });
      await loadSkills();
      setPage(1);
      toast.add({
        title: `Imported ${result.imported} skills`,
        type: result.errors.length ? 'warning' : 'success',
        description: result.errors.length ? result.errors.slice(0, 3).join('; ') : undefined,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed', 'error');
    }
  };

  const handleRecordUsage = async (id: string) => {
    try {
      await sendExtensionMessage('SKILL_RECORD_USAGE', { id });
      await loadSkills();
    } catch {
      showToast('Prompt copied, but usage could not be saved.', 'warning');
    }
  };

  const handleTogglePin = async (skill: Skill) => {
    try {
      await sendExtensionMessage('SKILL_UPDATE', {
        id: skill.id,
        patch: { pinned: !skill.pinned },
      });
      await loadSkills();
      setPage(1);
      showToast(skill.pinned ? 'Skill unpinned' : 'Skill pinned to top');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update pin', 'error');
    }
  };

  const createSkill = () => {
    setActiveTab('all');
    setEditingSkill(null);
    setDuplicateSkill(null);
    setIsEditing(true);
  };
  const hasFilters = Boolean(
    searchQuery.trim() ||
    selectedTags.length > 0 ||
    favoritesOnly ||
    view !== 'all' ||
    sort !== 'newest'
  );
  const clearFilters = () => {
    setView('all');
    setSort('newest');
    setPage(1);
    setSearchQuery('');
    setSelectedTags([]);
    setFavoritesOnly(false);
  };

  const searchBar = (
    <SearchBar
      value={searchQuery}
      onChange={(query) => {
        setSearchQuery(query);
        setPage(1);
      }}
      view={view}
      sort={sort}
      collections={collections}
      onViewChange={(nextView) => {
        setView(nextView);
        setPage(1);
      }}
      onSortChange={(nextSort) => {
        setSort(nextSort);
        setPage(1);
      }}
      onReset={clearFilters}
      tags={allTags}
      selectedTags={selectedTags}
      onTagsChange={(tags) => {
        setSelectedTags(tags);
        setPage(1);
      }}
      favoritesOnly={favoritesOnly}
      onToggleFavorites={() => {
        setFavoritesOnly((value) => !value);
        setPage(1);
      }}
    />
  );

  const library = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 pb-4 pt-3 text-helper text-muted-foreground">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page font-semibold tracking-tight text-foreground">
            {view === 'recent'
              ? 'Recently used'
              : view.startsWith('collection:')
                ? view.slice('collection:'.length) || 'Unassigned'
                : 'Skills'}
          </h1>
          <span aria-live="polite">
            {filteredSkills.length > 0 &&
              `${pageStart + 1}–${pageStart + visibleSkills.length} of `}
            {filteredSkills.length} {filteredSkills.length === 1 ? 'skill' : 'skills'}
            {hasFilters ? ' found' : ''}
          </span>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="xs" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>
      <SkillList
        skills={visibleSkills}
        searchQuery={searchQuery}
        selectedTags={selectedTags}
        onSelectTag={(tag) => {
          setSelectedTags((tags) =>
            tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag]
          );
          changePage(1);
        }}
        onEdit={(skill) => {
          setEditingSkill(skill);
          setDuplicateSkill(null);
          setIsEditing(true);
        }}
        onDuplicate={(skill) => {
          setEditingSkill(null);
          setDuplicateSkill(skill);
          setIsEditing(true);
        }}
        onTogglePin={handleTogglePin}
        onRecordUsage={handleRecordUsage}
        onDelete={handleDeleteSkill}
        onToggleFavorite={handleToggleFavorite}
        onShowToast={showToast}
        onCreateNew={createSkill}
        hasFilters={hasFilters}
        favoritesOnly={favoritesOnly}
        onClearFilters={clearFilters}
      />
      {filteredSkills.length > 0 && (
        <nav
          aria-label="Skill pagination"
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-4"
        >
          <FieldGroup className="w-auto">
            <Field orientation="horizontal" className="items-center gap-2">
              <FieldLabel htmlFor="skills-per-page" className="whitespace-nowrap">
                Per page
              </FieldLabel>
              <NativeSelect
                id="skills-per-page"
                className="w-16 shrink-0"
                aria-label="Skills per page"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  changePage(1);
                }}
              >
                {PAGE_SIZES.map((size) => (
                  <NativeSelectOption key={size} value={size}>
                    {size}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </FieldGroup>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous page"
              disabled={currentPage === 1}
              onClick={() => changePage(currentPage - 1)}
            >
              <ChevronLeft />
            </Button>
            <span
              role="status"
              aria-label="Current page"
              className="text-xs tabular-nums text-muted-foreground"
            >
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next page"
              disabled={currentPage === totalPages}
              onClick={() => changePage(currentPage + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );

  return (
    <TooltipProvider delay={300}>
      <div className="vault-shell mx-auto flex min-h-dvh w-full min-w-0 max-w-4xl flex-col px-4 sm:px-8">
        <div className="sticky top-0 z-30 bg-background">
          <header className="flex min-h-18 items-center justify-between gap-2 py-4">
            <button
              type="button"
              className="flex min-w-0 items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Back to vault"
              disabled={isEditing}
              onClick={() => setActiveTab('all')}
            >
              <Layers3 aria-hidden="true" className="size-5 shrink-0 text-primary" />
              <span className="truncate text-base font-semibold tracking-tight">Skill Vault</span>
            </button>
            {!isEditing && (
              <div className="flex shrink-0 items-center gap-1">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Trash"
                        aria-current={activeTab === 'trash' ? 'page' : undefined}
                        onClick={() => {
                          setActiveTab('trash');
                          void loadTrash();
                        }}
                      />
                    }
                  >
                    <Trash2 />
                  </TooltipTrigger>
                  <TooltipContent>Trash</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Settings"
                        aria-current={activeTab === 'settings' ? 'page' : undefined}
                        onClick={() => setActiveTab('settings')}
                      />
                    }
                  >
                    <SettingsIcon />
                  </TooltipTrigger>
                  <TooltipContent>Settings</TooltipContent>
                </Tooltip>
                <Button className="ml-2" aria-label="New skill" onClick={createSkill}>
                  <Plus data-icon="inline-start" />
                  <span className="new-skill-label">New skill</span>
                </Button>
              </div>
            )}
          </header>
          {!isEditing && activeTab === 'all' && <div className="pb-3 pt-1">{searchBar}</div>}
          <Separator />
        </div>
        {isEditing ? (
          <main className="flex-1 py-6">
            <SkillEditor
              key={
                editingSkill?.id ||
                (duplicateSkill ? `duplicate-${duplicateSkill.id}` : '') ||
                (draftSkill ? `draft-${draftSkill.timestamp || draftSkill.content}` : 'new')
              }
              geminiConfigured={geminiConfigured}
              initialSkill={editingSkill}
              duplicateOf={duplicateSkill}
              collections={collections}
              availableTags={allTags}
              initialDraftContent={
                !editingSkill && !duplicateSkill ? draftSkill?.content : undefined
              }
              draftSkill={!editingSkill && !duplicateSkill ? draftSkill : null}
              draftMeta={
                !editingSkill && !duplicateSkill && draftSkill
                  ? { title: draftSkill.title, url: draftSkill.url }
                  : null
              }
              onSave={async (data, id) => {
                await handleSaveSkill(data, id);
                if (draftSkill && !duplicateSkill) await handleDismissDraft();
              }}
              onCancel={async () => {
                setIsEditing(false);
                setEditingSkill(null);
                setDuplicateSkill(null);
                if (draftSkill && !duplicateSkill) await handleDismissDraft();
              }}
            />
          </main>
        ) : (
          <main className="flex flex-1 flex-col pb-8 pt-4">
            {activeTab !== 'all' && (
              <Button
                variant="ghost"
                className="-ml-2 mb-5 w-fit"
                onClick={() => setActiveTab('all')}
              >
                <ArrowLeft data-icon="inline-start" />
                Back to vault
              </Button>
            )}
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
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
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
                    showToast(
                      err instanceof Error ? err.message : 'Could not save settings',
                      'error'
                    );
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

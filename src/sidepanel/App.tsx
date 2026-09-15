import React, { useEffect, useState, useMemo } from 'react';
import { Plus, BookOpen, Star, Settings as SettingsIcon, AlertCircle } from 'lucide-react';
import { Skill, CreateSkillInput, SkillVaultSettings, DEFAULT_SETTINGS } from '../domain/types';
import { DraftSkill } from '../domain/template-detector';
import { sendExtensionMessage } from '../infrastructure/messaging/client';
import { SearchBar } from './components/SearchBar';
import { SkillList } from './components/SkillList';
import { SkillEditor } from './components/SkillEditor';
import { Settings } from './components/Settings';

type ActiveTab = 'all' | 'favorites' | 'settings';

export const App: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [settings, setSettings] = useState<SkillVaultSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  // Draft text from right-click context menu
  const [draftSkill, setDraftSkill] = useState<DraftSkill | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const loadSkills = async () => {
    try {
      const list = await sendExtensionMessage('SKILL_LIST');
      setSkills(list);
    } catch (err) {
      console.error('Failed to load skills:', err);
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
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, []);

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
        const q = searchQuery.toLowerCase();
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
      showToast('Skill deleted');
      await loadSkills();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete');
    }
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

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-row">
          <img src="/icons/icon-32.png" alt="Skill Vault" className="brand-icon" />
          <span className="brand-title">Skill Vault</span>
          <span className="brand-tag">v0.1</span>
        </div>
        <div className="header-actions">
          {!isEditing && (
            <button
              className="btn-primary"
              onClick={() => {
                setEditingSkill(null);
                setIsEditing(true);
              }}
            >
              <Plus size={14} /> New Skill
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      {!isEditing && (
        <nav className="nav-tabs">
          <button
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <BookOpen size={13} /> Vault ({skills.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            <Star size={13} /> Favorites ({skills.filter((s) => s.favorite).length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={13} /> Settings
          </button>
        </nav>
      )}

      {/* Body Area */}
      <main className="main-content">
        {/* Highlighted text draft banner */}
        {!isEditing && draftSkill && (
          <div className="draft-alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} color="#FF453A" />
              <span className="draft-alert-text">
                Selection saved: <strong>{draftSkill.formatLabel || 'Content'}</strong>. Ready to
                create skill!
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn-primary"
                style={{ padding: '4px 8px', fontSize: 11 }}
                onClick={handleUseDraft}
              >
                Create
              </button>
              <button
                className="btn-secondary"
                style={{ padding: '4px 8px', fontSize: 11 }}
                onClick={handleDismissDraft}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {isEditing ? (
          <SkillEditor
            key={
              editingSkill?.id ||
              (draftSkill ? `draft-${draftSkill.timestamp || draftSkill.content}` : 'new')
            }
            initialSkill={editingSkill}
            initialDraftContent={!editingSkill ? draftSkill?.content : undefined}
            draftSkill={!editingSkill ? draftSkill : null}
            draftMeta={
              !editingSkill && draftSkill ? { title: draftSkill.title, url: draftSkill.url } : null
            }
            onSave={async (data, id) => {
              await handleSaveSkill(data, id);
              if (draftSkill) {
                await handleDismissDraft();
              }
            }}
            onCancel={async () => {
              setIsEditing(false);
              setEditingSkill(null);
              if (draftSkill) {
                await handleDismissDraft();
              }
            }}
          />
        ) : activeTab === 'settings' ? (
          <Settings
            settings={settings}
            skills={skills}
            onUpdateSettings={async (patch) => {
              const updated = await sendExtensionMessage('SETTINGS_UPDATE', patch);
              setSettings(updated);
              showToast('Settings saved');
            }}
            onExport={handleExport}
            onImport={handleImport}
          />
        ) : (
          <>
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              tags={allTags}
              selectedTag={selectedTag}
              onSelectTag={setSelectedTag}
            />

            <SkillList
              skills={filteredSkills}
              onEdit={(skill) => {
                setEditingSkill(skill);
                setIsEditing(true);
              }}
              onDelete={handleDeleteSkill}
              onToggleFavorite={handleToggleFavorite}
              onShowToast={showToast}
              onCreateNew={() => {
                setEditingSkill(null);
                setIsEditing(true);
              }}
            />
          </>
        )}
      </main>

      {/* Toast */}
      {toastMessage && <div className="toast">{toastMessage}</div>}
    </div>
  );
};

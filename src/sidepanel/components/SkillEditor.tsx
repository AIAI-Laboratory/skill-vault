import React, { useState } from 'react';
import { Save, X, Star } from 'lucide-react';
import { Skill, CreateSkillInput } from '../../domain/types';
import { isValidShortcut } from '../../domain/skill';

interface SkillEditorProps {
  initialSkill?: Skill | null;
  initialDraftContent?: string;
  draftMeta?: { url?: string; title?: string } | null;
  onSave: (skillData: CreateSkillInput, id?: string) => Promise<void>;
  onCancel: () => void;
}

export const SkillEditor: React.FC<SkillEditorProps> = ({
  initialSkill,
  initialDraftContent,
  draftMeta,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(initialSkill?.name || '');
  const [shortcut, setShortcut] = useState(initialSkill?.shortcut || '');
  const [description, setDescription] = useState(initialSkill?.description || '');
  const [content, setContent] = useState(initialSkill?.content || initialDraftContent || '');
  const [tagsStr, setTagsStr] = useState((initialSkill?.tags || []).join(', '));
  const [favorite, setFavorite] = useState(initialSkill?.favorite || false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const shortcutCheck = isValidShortcut(shortcut);

  const handleInsertVariable = (varName: string) => {
    setContent((prev) => `${prev}{{${varName}}}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Skill name is required.');
      return;
    }

    if (!content.trim()) {
      setError('Prompt content cannot be empty.');
      return;
    }

    if (shortcut && !shortcutCheck.valid) {
      setError(shortcutCheck.error || 'Invalid shortcut.');
      return;
    }

    const tags = tagsStr
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    setSaving(true);
    try {
      await onSave(
        {
          name: name.trim(),
          shortcut: shortcut.trim() ? shortcut.trim().toLowerCase() : undefined,
          description: description.trim(),
          content,
          tags,
          favorite,
          variables: [],
        },
        initialSkill?.id
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to save skill.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="editor-form" onSubmit={handleSubmit}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>
          {initialSkill ? 'Edit Skill' : 'Create New Skill'}
        </h3>
        <button type="button" className="btn-icon" onClick={onCancel} title="Close">
          <X size={16} />
        </button>
      </div>

      {draftMeta && (
        <div
          style={{
            background: 'rgba(255, 69, 58, 0.12)',
            border: '1px solid var(--accent-red-border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            fontSize: 12,
            color: '#FEE2E2',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>
            Draft text imported from: <strong>{draftMeta.title || draftMeta.url || 'Webpage selection'}</strong>
          </span>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label className="form-label">
          Skill Name <span className="req">*</span>
        </label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g. Senior Code Review"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          Slash Shortcut <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g. review (without slash)"
          value={shortcut}
          onChange={(e) => setShortcut(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
        />
        <div className="form-hint">
          {shortcut ? (
            shortcutCheck.valid ? (
              <span style={{ color: '#10B981' }}>Trigger in AI with: <code>/{shortcut}</code></span>
            ) : (
              <span style={{ color: '#EF4444' }}>{shortcutCheck.error}</span>
            )
          ) : (
            'Allows quick triggering via /<shortcut>'
          )}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <input
          type="text"
          className="form-input"
          placeholder="Short summary of what this skill does"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          Prompt Content <span className="req">*</span>
        </label>
        <textarea
          className="form-textarea"
          placeholder="Enter prompt instructions... Use {{selected_text}} to automatically inject highlighted text."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
        <div className="form-hint">Insert variable:</div>
        <div className="var-chips">
          <button
            type="button"
            className="var-chip-btn"
            onClick={() => handleInsertVariable('selected_text')}
          >
            + {"{{selected_text}}"}
          </button>
          <button
            type="button"
            className="var-chip-btn"
            onClick={() => handleInsertVariable('current_date')}
          >
            + {"{{current_date}}"}
          </button>
          <button
            type="button"
            className="var-chip-btn"
            onClick={() => handleInsertVariable('page_title')}
          >
            + {"{{page_title}}"}
          </button>
          <button
            type="button"
            className="var-chip-btn"
            onClick={() => handleInsertVariable('page_url')}
          >
            + {"{{page_url}}"}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Tags</label>
        <input
          type="text"
          className="form-input"
          placeholder="Comma separated: coding, review, python"
          value={tagsStr}
          onChange={(e) => setTagsStr(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          id="fav-check"
          checked={favorite}
          onChange={(e) => setFavorite(e.target.checked)}
          style={{ accentColor: '#FF453A', cursor: 'pointer' }}
        />
        <label
          htmlFor="fav-check"
          style={{ fontSize: 13, color: '#D1D5DB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Star size={14} fill={favorite ? '#FBBF24' : 'none'} color={favorite ? '#FBBF24' : '#9CA3AF'} />
          Add to Favorites
        </label>
      </div>

      <div className="editor-footer">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          <Save size={14} /> {saving ? 'Saving...' : 'Save Skill'}
        </button>
      </div>
    </form>
  );
};

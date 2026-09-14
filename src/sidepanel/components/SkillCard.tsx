import React, { useState } from 'react';
import { Star, Copy, Check, Edit2, Trash2 } from 'lucide-react';
import { Skill } from '../../domain/types';

interface SkillCardProps {
  skill: Skill;
  onEdit: (skill: Skill) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onShowToast: (msg: string) => void;
}

export const SkillCard: React.FC<SkillCardProps> = ({
  skill,
  onEdit,
  onDelete,
  onToggleFavorite,
  onShowToast,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(skill.content);
      setCopied(true);
      onShowToast('Prompt copied to clipboard!');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      onShowToast('Failed to copy');
    }
  };

  return (
    <div className="skill-card">
      <div className="skill-card-top">
        <div className="skill-title-group">
          <span className="skill-name">{skill.name}</span>
          {skill.shortcut && <span className="shortcut-chip">/{skill.shortcut}</span>}
        </div>
        <button
          className={`fav-btn ${skill.favorite ? 'active' : ''}`}
          onClick={() => onToggleFavorite(skill.id, skill.favorite)}
          title={skill.favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={15} fill={skill.favorite ? '#FBBF24' : 'none'} />
        </button>
      </div>

      {skill.description && <div className="skill-desc">{skill.description}</div>}

      <div className="skill-prompt-preview">{skill.content}</div>

      <div className="skill-card-bottom">
        <div className="skill-card-tags">
          {(skill.tags || []).map((tag) => (
            <span key={tag} className="tag-pill" style={{ fontSize: 10, padding: '1px 6px' }}>
              #{tag}
            </span>
          ))}
          {skill.usage && skill.usage.count > 0 && (
            <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 4 }}>
              Used {skill.usage.count}x
            </span>
          )}
        </div>

        <div className="skill-card-actions">
          <button className="btn-icon" onClick={handleCopy} title="Copy prompt">
            {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
          </button>
          <button className="btn-icon" onClick={() => onEdit(skill)} title="Edit skill">
            <Edit2 size={14} />
          </button>
          <button
            className="btn-icon"
            onClick={() => {
              if (confirm(`Delete skill "${skill.name}"?`)) {
                onDelete(skill.id);
              }
            }}
            title="Delete skill"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

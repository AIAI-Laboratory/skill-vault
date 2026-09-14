import React from 'react';
import { Plus } from 'lucide-react';
import { Skill } from '../../domain/types';
import { SkillCard } from './SkillCard';

interface SkillListProps {
  skills: Skill[];
  onEdit: (skill: Skill) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onShowToast: (msg: string) => void;
  onCreateNew: () => void;
}

export const SkillList: React.FC<SkillListProps> = ({
  skills,
  onEdit,
  onDelete,
  onToggleFavorite,
  onShowToast,
  onCreateNew,
}) => {
  if (skills.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-title">No skills found</div>
        <div className="empty-desc">
          Add your favorite prompts and commands to access them anywhere with <code>/skill</code>.
        </div>
        <button className="btn-primary" onClick={onCreateNew} style={{ marginTop: 8 }}>
          <Plus size={14} /> Create First Skill
        </button>
      </div>
    );
  }

  return (
    <div className="skills-list">
      {skills.map((skill) => (
        <SkillCard
          key={skill.id}
          skill={skill}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
          onShowToast={onShowToast}
        />
      ))}
    </div>
  );
};

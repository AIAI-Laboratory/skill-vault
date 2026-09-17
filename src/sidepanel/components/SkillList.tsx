import { BookOpen, Plus, Search, Star } from 'lucide-react';
import { Skill } from '../../domain/types';
import { SkillCard } from './SkillCard';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';

interface SkillListProps {
  skills: Skill[];
  onEdit: (skill: Skill) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onShowToast: (msg: string) => void;
  onCreateNew: () => void;
  hasFilters: boolean;
  favoritesOnly: boolean;
  onClearFilters: () => void;
}

export function SkillList({
  skills,
  onCreateNew,
  hasFilters,
  favoritesOnly,
  onClearFilters,
  ...actions
}: SkillListProps) {
  if (skills.length === 0) {
    const Icon = hasFilters ? Search : favoritesOnly ? Star : BookOpen;
    return (
      <Empty className="min-h-64 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>
            {hasFilters
              ? 'No matching skills'
              : favoritesOnly
                ? 'Keep your best skills close'
                : 'Your next great prompt starts here'}
          </EmptyTitle>
          <EmptyDescription>
            {hasFilters
              ? 'Try a different search or clear your filters to see more skills.'
              : favoritesOnly
                ? 'Star a skill in your vault and it will appear here for quick access.'
                : 'Save a prompt once, then bring it into any AI conversation with /skill.'}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {hasFilters ? (
            <Button variant="outline" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : (
            !favoritesOnly && (
              <Button onClick={onCreateNew}>
                <Plus data-icon="inline-start" />
                Create your first skill
              </Button>
            )
          )}
        </EmptyContent>
      </Empty>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {skills.map((skill) => (
        <SkillCard key={skill.id} skill={skill} {...actions} />
      ))}
    </div>
  );
}

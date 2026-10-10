import { useEffect, useRef, useState } from 'react';
import { Star, Copy, Check, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { Skill } from '../../domain/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SkillCardProps {
  skill: Skill;
  searchQuery?: string;
  onEdit: (skill: Skill) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onShowToast: (msg: string) => void;
}

export function SkillCard({
  skill,
  searchQuery = '',
  onEdit,
  onDelete,
  onToggleFavorite,
  onShowToast,
}: SkillCardProps) {
  const [copied, setCopied] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const query = searchQuery.trim().replace(/^\//, '');
  const highlight = (text: string) => {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.split(new RegExp(`(${escaped})`, 'gi')).map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="rounded-sm bg-primary/20 text-foreground">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(skill.content);
      setCopied(true);
      onShowToast('Prompt copied to clipboard');
      clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      onShowToast('Could not copy. Please try again.');
    }
  };

  return (
    <Card size="sm" className="w-full min-w-0 shrink-0 gap-0 py-0 select-none">
      <div className="flex min-w-0 items-center gap-2 p-3 pb-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CardTitle className="min-w-0 flex-1 truncate" title={skill.name}>
            {highlight(skill.name)}
          </CardTitle>
          {skill.shortcut && (
            <Badge variant="outline" className="max-w-[40%] shrink-0" title={`/${skill.shortcut}`}>
              <span className="max-w-36 truncate font-mono">/{skill.shortcut}</span>
            </Badge>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={
                  skill.favorite
                    ? `Remove ${skill.name} from favorites`
                    : `Add ${skill.name} to favorites`
                }
                aria-pressed={skill.favorite}
                onClick={() => onToggleFavorite(skill.id, skill.favorite)}
              />
            }
          >
            <Star className={cn(skill.favorite && 'fill-primary text-primary')} />
          </TooltipTrigger>
          <TooltipContent>
            {skill.favorite ? 'Remove from favorites' : 'Add to favorites'}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex min-w-0 flex-col gap-3 px-3 pb-3">
        {skill.description && (
          <CardDescription className="min-w-0 break-words select-text">
            {highlight(skill.description)}
          </CardDescription>
        )}
        {skill.tags.length > 0 && (
          <div
            className="scrollbar-none flex min-w-0 items-start gap-2 overflow-x-auto py-0.5"
            tabIndex={0}
            role="region"
            aria-label={`Tags for ${skill.name}`}
          >
            {skill.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="shrink-0" title={tag}>
                <span className="max-w-48 truncate">{highlight(tag)}</span>
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div
        id={`skill-prompt-${skill.id}`}
        className={cn('min-w-0 px-3 pb-3', !promptOpen && 'hidden')}
      >
        <p className="scrollbar-none max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-muted/70 p-3 font-mono text-xs leading-relaxed text-muted-foreground select-text">
          {skill.content}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={promptOpen}
          aria-controls={`skill-prompt-${skill.id}`}
          className="gap-1.5 px-2 text-muted-foreground"
          onClick={() => setPromptOpen((value) => !value)}
        >
          Prompt
          <ChevronDown
            className={`size-4 transition-transform ${promptOpen ? 'rotate-180' : ''}`}
          />
        </Button>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${skill.name} to trash`}
                  onClick={() => onDelete(skill.id)}
                />
              }
            >
              <Trash2 />
            </TooltipTrigger>
            <TooltipContent>Move to trash · restore within 24h</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${skill.name}`}
                  onClick={() => onEdit(skill)}
                />
              }
            >
              <Pencil />
            </TooltipTrigger>
            <TooltipContent>Edit skill</TooltipContent>
          </Tooltip>
          <Button size="sm" variant="outline" onClick={handleCopy}>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Star, Copy, Check, Pencil, Trash2, ArrowUpRight } from 'lucide-react';
import { Skill } from '../../domain/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SkillCardProps {
  skill: Skill;
  onEdit: (skill: Skill) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onShowToast: (msg: string) => void;
}

export function SkillCard({
  skill,
  onEdit,
  onDelete,
  onToggleFavorite,
  onShowToast,
}: SkillCardProps) {
  const [copied, setCopied] = useState(false);
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
    <Card size="sm" className="h-72 w-full min-w-0 shrink-0">
      <CardHeader className="h-20 min-w-0 shrink-0">
        <div className="mb-1 flex h-6 min-w-0 items-center gap-2">
          <CardTitle className="min-w-0 flex-1 truncate" title={skill.name}>
            {skill.name}
          </CardTitle>
          {skill.shortcut && (
            <Badge variant="outline" className="max-w-[40%] shrink-0" title={`/${skill.shortcut}`}>
              <span className="max-w-36 truncate font-mono">/{skill.shortcut}</span>
            </Badge>
          )}
        </div>
        {skill.description && (
          <CardDescription className="min-w-0 line-clamp-2 break-words">
            {skill.description}
          </CardDescription>
        )}
        <CardAction>
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
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 min-w-0 flex-1">
        <div className="h-20 overflow-hidden rounded-lg bg-background/70 px-3 py-2.5">
          <p className="line-clamp-3 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
            {skill.content}
          </p>
        </div>
        {skill.tags.length > 0 && (
          <div
            className="scrollbar-none mt-3 flex h-6 min-w-0 items-start gap-1.5 overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label={`Tags for ${skill.name}`}
          >
            {skill.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="shrink-0" title={tag}>
                <span className="max-w-48 truncate">{tag}</span>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="shrink-0 justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
          <ArrowUpRight className="size-3 shrink-0" />
          <span className="truncate">
            {skill.usage?.count ? `Used ${skill.usage.count} times` : 'Ready when you are'}
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-1">
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
      </CardFooter>
    </Card>
  );
}

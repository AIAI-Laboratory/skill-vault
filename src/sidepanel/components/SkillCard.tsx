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
    <Card size="sm" className="min-w-0">
      <CardHeader>
        <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
          <CardTitle className="min-w-0 break-words">{skill.name}</CardTitle>
          {skill.shortcut && (
            <Badge variant="outline">
              <span className="max-w-36 truncate font-mono">/{skill.shortcut}</span>
            </Badge>
          )}
        </div>
        {skill.description && (
          <CardDescription className="line-clamp-2 break-words">
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
      <CardContent>
        <div className="rounded-lg bg-background/70 px-3 py-2.5">
          <p className="line-clamp-3 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
            {skill.content}
          </p>
        </div>
        {skill.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {skill.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                <span className="max-w-48 truncate">{tag}</span>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-2">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <ArrowUpRight className="size-3" />
          {skill.usage?.count ? `Used ${skill.usage.count} times` : 'Ready when you are'}
        </span>
        <div className="flex items-center gap-1">
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

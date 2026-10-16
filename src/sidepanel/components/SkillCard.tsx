import { useEffect, useRef, useState } from 'react';
import {
  Star,
  Copy,
  Check,
  Pencil,
  Trash2,
  ChevronRight,
  MoreHorizontal,
  Pin,
  PinOff,
  CopyPlus,
  Code2,
  PenLine,
  BookOpen,
  Search,
  Zap,
  Layers3,
  GripVertical,
  type LucideIcon,
} from 'lucide-react';
import { Skill } from '../../domain/types';
import { getSkillCollection } from '../../domain/library';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ToastTone } from '@/components/ui/toast';
import { writeSkillDragData } from '../../infrastructure/skill-drag';

const COLLECTION_ICONS: Record<string, LucideIcon> = {
  Coding: Code2,
  Writing: PenLine,
  Research: Search,
  Productivity: Zap,
  Learning: BookOpen,
};

interface SkillCardProps {
  skill: Skill;
  searchQuery?: string;
  selectedTags?: string[];
  onSelectTag: (tag: string) => void;
  onEdit: (skill: Skill) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onTogglePin: (skill: Skill) => void;
  onDuplicate: (skill: Skill) => void;
  onRecordUsage: (id: string) => Promise<void>;
  onShowToast: (msg: string, type?: ToastTone) => void;
}

export function SkillCard({
  skill,
  searchQuery = '',
  selectedTags = [],
  onSelectTag,
  onEdit,
  onDelete,
  onToggleFavorite,
  onTogglePin,
  onDuplicate,
  onRecordUsage,
  onShowToast,
}: SkillCardProps) {
  const [copied, setCopied] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const collection =
    getSkillCollection(skill) || (skill.tags.includes('learning') ? 'Learning' : '');
  const CollectionIcon = COLLECTION_ICONS[collection] ?? Layers3;
  const terms = searchQuery
    .toLowerCase()
    .split(/[\s,]+/)
    .map((term) => term.replace(/^[#/]/, ''))
    .filter(Boolean);
  const highlight = (text: string) => {
    if (!terms.length) return text;
    const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return text.split(new RegExp(`(${escaped})`, 'gi')).map((part, index) =>
      terms.includes(part.toLowerCase()) ? (
        <mark key={index} className="bg-primary/20 text-foreground">
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
      clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 1500);
      void onRecordUsage(skill.id);
    } catch {
      onShowToast('Could not copy. Please try again.', 'error');
    }
  };

  return (
    <li
      className={cn('skill-row min-w-0 cursor-pointer', promptOpen && 'is-open')}
      data-dragging={dragging || undefined}
      onClick={(event) => {
        const target = event.target as Element;
        if (
          !event.currentTarget.contains(target) ||
          target.closest('button, a, input, select, textarea, [role="menuitem"], .skill-prompt')
        )
          return;
        setPromptOpen((value) => !value);
      }}
    >
      <div
        className="group/drag flex min-w-0 cursor-grab items-start gap-2 py-4 active:cursor-grabbing"
        draggable
        title="Drag this skill into a chat input"
        onDragStart={(event) => {
          writeSkillDragData(event.dataTransfer, skill);
          setDragging(true);
        }}
        onDragEnd={() => setDragging(false)}
      >
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="mt-1 size-4 shrink-0 text-muted-foreground">
            <CollectionIcon
              role="img"
              aria-label={collection ? `${collection} collection` : 'Skill'}
              className="size-4 group-hover/drag:hidden"
            />
            <GripVertical aria-hidden="true" className="hidden size-4 group-hover/drag:block" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <button
              type="button"
              className="skill-summary group flex min-w-0 flex-col gap-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`View prompt for ${skill.name}`}
              aria-expanded={promptOpen}
              aria-controls={`skill-prompt-${skill.id}`}
              onClick={() => setPromptOpen((value) => !value)}
            >
              <span className="flex w-full min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                {skill.pinned && (
                  <Pin aria-label="Pinned" className="size-3 shrink-0 self-center text-primary" />
                )}
                <span className="text-section font-semibold leading-6 text-foreground">
                  {highlight(skill.name)}
                </span>
                {skill.shortcut && (
                  <code className="max-w-full truncate font-mono text-xs text-primary">
                    /{highlight(skill.shortcut)}
                  </code>
                )}
                <ChevronRight
                  aria-hidden="true"
                  className={cn(
                    'ml-auto size-3 shrink-0 self-center text-muted-foreground transition-transform motion-reduce:transition-none',
                    promptOpen && 'rotate-90 text-primary'
                  )}
                />
              </span>
              {skill.description && (
                <span
                  className={cn('text-helper text-muted-foreground', !promptOpen && 'line-clamp-1')}
                >
                  {highlight(skill.description)}
                </span>
              )}
            </button>
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="shrink-0 text-xs tabular-nums text-muted-foreground"
                aria-label={`${skill.usage.count} ${skill.usage.count === 1 ? 'use' : 'uses'}`}
                title={
                  skill.usage.lastUsedAt
                    ? `Last used ${new Date(skill.usage.lastUsedAt).toLocaleString()}`
                    : 'Not used yet'
                }
              >
                {skill.usage.count} {skill.usage.count === 1 ? 'use' : 'uses'}
              </span>
              {skill.tags.length > 0 && (
                <div
                  className={cn(
                    'scrollbar-none flex min-w-0 gap-1.5 py-0.5',
                    promptOpen ? 'flex-wrap' : 'overflow-x-auto'
                  )}
                  aria-label={`Tags for ${skill.name}`}
                >
                  {skill.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="tag"
                      title={`Filter by #${tag}`}
                      render={
                        <button
                          type="button"
                          aria-label={`Filter by ${tag} tag`}
                          aria-pressed={selectedTags.includes(tag)}
                          onClick={() => onSelectTag(tag)}
                        />
                      }
                    >
                      <span className="max-w-32 truncate">#{highlight(tag)}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="skill-actions flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="quiet"
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
              <Star className={cn(skill.favorite && 'fill-current')} />
            </TooltipTrigger>
            <TooltipContent>
              {skill.favorite ? 'Remove from favorites' : 'Add to favorites'}
            </TooltipContent>
          </Tooltip>
          <span className="relative inline-flex">
            {copied && (
              <span role="status" className="copy-feedback">
                Copied
              </span>
            )}
            <Button
              size="default"
              variant="secondary"
              className="copy-action"
              data-copied={copied || undefined}
              aria-label={copied ? `Copied ${skill.name}` : `Copy ${skill.name} prompt`}
              onClick={handleCopy}
            >
              {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              <span className="copy-label">Copy</span>
            </Button>
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="quiet" size="icon-sm" aria-label={`Actions for ${skill.name}`} />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => onEdit(skill)}>
                  <Pencil /> Edit skill
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(skill)}>
                  <CopyPlus /> Duplicate skill
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onTogglePin(skill)}>
                  {skill.pinned ? <PinOff /> : <Pin />}
                  {skill.pinned ? 'Unpin' : 'Pin to top'}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(skill.id)}>
                  <Trash2 /> Move to trash
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div id={`skill-prompt-${skill.id}`} hidden={!promptOpen} className="pb-4 pt-1">
        <div className="skill-prompt rounded-sm p-3 sm:p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Prompt</p>
          <pre
            tabIndex={0}
            aria-label={`Prompt for ${skill.name}`}
            className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words pr-3 font-mono text-[13px] leading-6 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {skill.content}
          </pre>
        </div>
      </div>
    </li>
  );
}

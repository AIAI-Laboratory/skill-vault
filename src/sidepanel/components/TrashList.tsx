import { useState } from 'react';
import { RotateCcw, Clock3, Trash2, ChevronRight } from 'lucide-react';
import { TrashedSkill } from '../../domain/types';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface TrashListProps {
  entries: TrashedSkill[];
  onRestore: (entry: TrashedSkill) => Promise<void>;
}

export function TrashList({ entries, onRestore }: TrashListProps) {
  const [restoring, setRestoring] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-page font-semibold tracking-tight">Trash</h1>
        <p className="flex items-center gap-2 text-helper text-muted-foreground">
          <Clock3 className="size-3.5" /> Deleted permanently after 24 hours
        </p>
      </header>
      {entries.length === 0 ? (
        <Empty className="min-h-56 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Trash2 />
            </EmptyMedia>
            <EmptyTitle>All clear</EmptyTitle>
            <EmptyDescription>
              Your trash is empty. Deleted skills will appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul aria-label="Trashed skills">
          {entries.map((entry) => (
            <TrashRow
              key={entry.skill.id}
              entry={entry}
              restoring={restoring !== null}
              isRestoring={restoring === entry.skill.id}
              onRestore={async () => {
                setRestoring(entry.skill.id);
                try {
                  await onRestore(entry);
                } finally {
                  setRestoring(null);
                }
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TrashRow({
  entry,
  restoring,
  isRestoring,
  onRestore,
}: {
  entry: TrashedSkill;
  restoring: boolean;
  isRestoring: boolean;
  onRestore: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const expiresAt = new Date(entry.expiresAt);
  return (
    <li className="skill-row min-w-0">
      <div className="flex items-center gap-3 py-4">
        <button
          type="button"
          aria-label={`View deleted prompt for ${entry.skill.name}`}
          aria-expanded={expanded}
          aria-controls={`trash-prompt-${entry.skill.id}`}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setExpanded((value) => !value)}
        >
          <ChevronRight
            className={cn('mt-1 size-3.5 shrink-0 text-muted-foreground', expanded && 'rotate-90')}
          />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[15px] font-semibold">{entry.skill.name}</span>
            <span className="text-helper text-muted-foreground">
              Auto-deletes{' '}
              <time dateTime={expiresAt.toISOString()}>{expiresAt.toLocaleString()}</time>
            </span>
          </span>
        </button>
        <Button variant="outline" size="sm" disabled={restoring} onClick={onRestore}>
          {isRestoring ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RotateCcw data-icon="inline-start" />
          )}
          {isRestoring ? 'Restoring…' : 'Restore'}
        </Button>
      </div>
      <pre
        hidden={!expanded}
        id={`trash-prompt-${entry.skill.id}`}
        tabIndex={0}
        className="skill-prompt mb-4 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-sm p-3 font-mono text-[13px] leading-6"
      >
        {entry.skill.content}
      </pre>
    </li>
  );
}

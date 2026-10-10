import { useState } from 'react';
import { RotateCcw, Clock3, Trash2, ChevronDown } from 'lucide-react';
import { TrashedSkill } from '../../domain/types';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle } from '@/components/ui/alert';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';

interface TrashListProps {
  entries: TrashedSkill[];
  onRestore: (entry: TrashedSkill) => Promise<void>;
}

export function TrashList({ entries, onRestore }: TrashListProps) {
  const [restoring, setRestoring] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>
      <Alert>
        <Clock3 />
        <AlertTitle>Deleted permanently after 24 hours</AlertTitle>
      </Alert>
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
        entries.map((entry) => {
          const isRestoring = restoring === entry.skill.id;
          const expiresAt = new Date(entry.expiresAt);
          return (
            <TrashCard
              key={entry.skill.id}
              entry={entry}
              expiresAt={expiresAt}
              restoring={restoring !== null}
              isRestoring={isRestoring}
              onRestore={async () => {
                setRestoring(entry.skill.id);
                try {
                  await onRestore(entry);
                } finally {
                  setRestoring(null);
                }
              }}
            />
          );
        })
      )}
    </div>
  );
}

function TrashCard({
  entry,
  expiresAt,
  restoring,
  isRestoring,
  onRestore,
}: {
  entry: TrashedSkill;
  expiresAt: Date;
  restoring: boolean;
  isRestoring: boolean;
  onRestore: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card size="sm" className="w-full min-w-0 gap-0 py-0 select-none">
      <div className="flex min-w-0 items-center justify-between gap-3 p-3">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="truncate" title={entry.skill.name}>
            {entry.skill.name}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Auto-deletes{' '}
            <time dateTime={expiresAt.toISOString()}>{expiresAt.toLocaleString()}</time>
          </p>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`trash-prompt-${entry.skill.id}`}
          className="flex shrink-0 select-none items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Hide prompt' : 'Show prompt'}
          <ChevronDown className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div
        id={`trash-prompt-${entry.skill.id}`}
        className={`${expanded ? 'flex' : 'hidden'} min-w-0 flex-col px-3 pb-3`}
      >
        <p className="scrollbar-none max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-muted/70 p-3 font-mono text-xs leading-relaxed text-muted-foreground select-text">
          {entry.skill.content}
        </p>
      </div>
      <div className="flex justify-end px-3 pb-3">
        <Button variant="outline" size="sm" disabled={restoring} onClick={onRestore}>
          {isRestoring ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RotateCcw data-icon="inline-start" />
          )}
          {isRestoring ? 'Restoring…' : 'Restore'}
        </Button>
      </div>
    </Card>
  );
}

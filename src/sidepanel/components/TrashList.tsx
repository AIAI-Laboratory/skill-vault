import { useState } from 'react';
import { RotateCcw, Clock3, Trash2 } from 'lucide-react';
import { TrashedSkill } from '../../domain/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Room for a second thought.</h1>
        <p className="mt-1 text-muted-foreground">Restore a skill before it is gone for good.</p>
      </div>
      <Alert>
        <Clock3 />
        <AlertTitle>A 24-hour safety net</AlertTitle>
        <AlertDescription>
          Skills are permanently deleted 24 hours after moving to trash.
        </AlertDescription>
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
        entries.map((entry) => (
          <Card size="sm" key={entry.skill.id}>
            <CardHeader>
              <CardTitle className="break-words">{entry.skill.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="line-clamp-3 break-words text-sm text-muted-foreground">
                {entry.skill.content}
              </p>
            </CardContent>
            <CardFooter className="flex-wrap justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Deletes{' '}
                <time dateTime={new Date(entry.expiresAt).toISOString()}>
                  {new Date(entry.expiresAt).toLocaleString()}
                </time>
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={restoring !== null}
                onClick={async () => {
                  setRestoring(entry.skill.id);
                  try {
                    await onRestore(entry);
                  } finally {
                    setRestoring(null);
                  }
                }}
              >
                {restoring === entry.skill.id ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RotateCcw data-icon="inline-start" />
                )}
                {restoring === entry.skill.id ? 'Restoring…' : 'Restore'}
              </Button>
            </CardFooter>
          </Card>
        ))
      )}
    </div>
  );
}

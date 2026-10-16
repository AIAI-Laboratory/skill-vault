import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface TagPickerProps {
  tags: string[];
  availableTags: string[];
  disabled: boolean;
  onChange: (tags: string[]) => void;
}

export function TagPicker({ tags, availableTags, disabled, onChange }: TagPickerProps) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().replace(/^#+/, '').toLowerCase();
  const options = [...new Set([...tags, ...availableTags])];
  const matches = options.filter((tag) => tag.includes(normalized));
  const canCreate = Boolean(normalized && !options.includes(normalized));
  const addTag = () => {
    if (!normalized) return;
    onChange([...new Set([...tags, normalized])]);
    setQuery('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="tag"
          render={
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(tags.filter((item) => item !== tag))}
            />
          }
        >
          <span className="max-w-40 truncate">#{tag}</span>
          <X data-icon="inline-end" />
        </Badge>
      ))}
      <Popover
        onOpenChange={(open) => {
          if (!open) setQuery('');
        }}
      >
        <PopoverTrigger
          render={
            <Button id="skill-tags" type="button" variant="outline" size="sm" disabled={disabled} />
          }
        >
          <Plus data-icon="inline-start" />
          {tags.length ? 'Add tags' : 'Choose or create tags'}
        </PopoverTrigger>
        <PopoverContent align="start" className="max-w-[calc(100vw-2rem)] gap-3 p-3">
          <PopoverTitle>Tags</PopoverTitle>
          <Input
            aria-label="Find or create a tag"
            placeholder="Find or create a tag…"
            value={query}
            disabled={disabled}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addTag();
              }
            }}
          />
          <ToggleGroup
            multiple
            orientation="vertical"
            aria-label="Choose tags"
            variant="tag"
            value={tags}
            onValueChange={onChange}
            disabled={disabled}
            className="max-h-52 w-full overflow-y-auto"
            spacing={1}
          >
            {matches.map((tag) => (
              <ToggleGroupItem key={tag} value={tag} className="w-full justify-start">
                <span className="min-w-0 flex-1 truncate text-left">#{tag}</span>
                {tags.includes(tag) && <Check data-icon="inline-end" />}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {canCreate && (
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={addTag}
              className="justify-start"
            >
              <Plus data-icon="inline-start" />
              <span className="truncate">Create #{normalized}</span>
            </Button>
          )}
          {!matches.length && !normalized && (
            <p className="text-xs text-muted-foreground">Type a name to create your first tag.</p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

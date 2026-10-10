import { useRef } from 'react';
import { Search, SlidersHorizontal, Star, X } from 'lucide-react';
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from '@/components/ui/input-group';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  favoritesOnly: boolean;
  onToggleFavorites: () => void;
}

export function SearchBar({
  value,
  onChange,
  tags,
  selectedTag,
  onSelectTag,
  favoritesOnly,
  onToggleFavorites,
}: SearchBarProps) {
  const filterRef = useRef<HTMLDetailsElement>(null);
  const quickTags = selectedTag
    ? [selectedTag, ...tags.filter((tag) => tag !== selectedTag)].slice(0, 4)
    : tags.slice(0, 4);
  const selectTag = (tag: string | null) => {
    onSelectTag(tag);
    if (filterRef.current) filterRef.current.open = false;
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 gap-2">
        <InputGroup className="h-10 flex-1 bg-muted dark:bg-muted">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            className="[&::-webkit-search-cancel-button]:hidden"
            aria-label="Search skills"
            placeholder="Search skills…"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          {value && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Clear search"
                onClick={() => onChange('')}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <details ref={filterRef} className="relative shrink-0">
          <summary
            aria-label="Filter by tag"
            className="flex h-10 list-none select-none cursor-pointer items-center gap-2 rounded-lg border border-input bg-muted px-3 text-sm font-medium marker:content-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden dark:bg-muted"
          >
            <SlidersHorizontal className="size-4" />
            <span>Filter</span>
            {(selectedTag || favoritesOnly) && (
              <span className="size-1.5 rounded-full bg-primary" />
            )}
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-64 max-w-[calc(100vw-2.5rem)] rounded-lg border border-border bg-popover p-2 text-popover-foreground">
            <button
              type="button"
              aria-pressed={favoritesOnly}
              className={`mb-2 flex w-full select-none items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm ${favoritesOnly ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted hover:bg-accent'}`}
              onClick={onToggleFavorites}
            >
              <Star className="size-4" />
              Favorites only
            </button>
            <div className="scrollbar-none flex max-h-48 flex-wrap gap-2 overflow-y-auto">
              <button
                type="button"
                aria-pressed={!selectedTag}
                className={`max-w-full select-none rounded-md border px-2.5 py-1.5 text-sm ${!selectedTag ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted hover:bg-accent'}`}
                onClick={() => selectTag(null)}
              >
                All tags
              </button>
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={selectedTag === tag}
                  title={tag}
                  className={`max-w-full select-none rounded-md border px-2.5 py-1.5 text-sm ${selectedTag === tag ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted hover:bg-accent'}`}
                  onClick={() => selectTag(tag)}
                >
                  <span className="block max-w-40 truncate">#{tag}</span>
                </button>
              ))}
            </div>
          </div>
        </details>
      </div>
      {quickTags.length > 0 && (
        <div role="group" aria-label="Quick tag filters" className="flex flex-wrap gap-2">
          {quickTags.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={selectedTag === tag}
              className={`max-w-full rounded-md border px-2.5 py-1 text-sm ${selectedTag === tag ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted hover:bg-accent'}`}
              onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
            >
              <span className="block max-w-32 truncate">#{tag}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

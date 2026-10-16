import { useState } from 'react';
import { Search, SlidersHorizontal, Star, X } from 'lucide-react';
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from '@/components/ui/input-group';
import { Popover, PopoverTrigger, PopoverContent, PopoverTitle } from '@/components/ui/popover';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,
} from '@/components/ui/native-select';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { SKILL_SORTS, type SkillSort } from '../../domain/library';

interface SearchBarProps {
  view: string;
  sort: SkillSort;
  collections: string[];
  onViewChange: (view: string) => void;
  onSortChange: (sort: SkillSort) => void;
  onReset: () => void;
  value: string;
  onChange: (val: string) => void;
  tags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  favoritesOnly: boolean;
  onToggleFavorites: () => void;
}

export function SearchBar({
  view,
  sort,
  collections,
  onViewChange,
  onSortChange,
  onReset,
  value,
  onChange,
  tags,
  selectedTags,
  onTagsChange,
  favoritesOnly,
  onToggleFavorites,
}: SearchBarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const hasFilters = Boolean(
    selectedTags.length || favoritesOnly || view !== 'all' || sort !== 'newest'
  );
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <InputGroup className="h-10">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          className="[&::-webkit-search-cancel-button]:hidden"
          aria-label="Search skills"
          placeholder="Search name, /command, #tag #tag…"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <InputGroupAddon align="inline-end">
          {value && (
            <InputGroupButton size="icon-sm" aria-label="Clear search" onClick={() => onChange('')}>
              <X />
            </InputGroupButton>
          )}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger
              render={
                <InputGroupButton
                  size="icon-sm"
                  className="relative"
                  aria-label={hasFilters ? 'Filters (active)' : 'Filters'}
                />
              }
            >
              <SlidersHorizontal />
              {hasFilters && (
                <span className="absolute top-1 right-1 size-1.5 rounded-sm bg-primary" />
              )}
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="max-h-[calc(100dvh-8rem)] max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <PopoverTitle>Filters</PopoverTitle>
                <Button size="xs" variant="ghost" disabled={!hasFilters} onClick={onReset}>
                  Reset
                </Button>
              </div>
              <FieldGroup className="gap-3">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="library-view">Collection or view</FieldLabel>
                  <NativeSelect
                    id="library-view"
                    className="w-full"
                    aria-label="Collection or view"
                    value={view}
                    onChange={(event) => onViewChange(event.target.value)}
                  >
                    <NativeSelectOption value="all">All skills</NativeSelectOption>
                    <NativeSelectOption value="recent">Recently used</NativeSelectOption>
                    <NativeSelectOptGroup label="Collections">
                      {collections.map((name) => (
                        <NativeSelectOption key={name} value={`collection:${name}`}>
                          {name}
                        </NativeSelectOption>
                      ))}
                      <NativeSelectOption value="collection:">Unassigned</NativeSelectOption>
                    </NativeSelectOptGroup>
                  </NativeSelect>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="library-sort">Sort by</FieldLabel>
                  <NativeSelect
                    id="library-sort"
                    className="w-full"
                    aria-label="Sort skills"
                    value={view === 'recent' ? 'recent' : sort}
                    disabled={view === 'recent'}
                    onChange={(event) => onSortChange(event.target.value as SkillSort)}
                  >
                    {Object.entries(SKILL_SORTS).map(([value, label]) => (
                      <NativeSelectOption key={value} value={value}>
                        {label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </FieldGroup>
              <Toggle
                pressed={favoritesOnly}
                onPressedChange={onToggleFavorites}
                className="w-full justify-start"
              >
                <Star /> Favorites only
              </Toggle>
              <Separator />
              <p className="text-xs text-muted-foreground">Tags · Match all selected</p>
              <ToggleGroup
                aria-label="Filter by tag"
                variant="tag"
                multiple
                value={selectedTags}
                onValueChange={onTagsChange}
                className="max-h-56 w-full flex-wrap justify-start overflow-y-auto"
                spacing={1}
              >
                {tags.map((tag) => (
                  <ToggleGroupItem key={tag} value={tag} title={tag}>
                    <span className="max-w-44 truncate">#{tag}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </PopoverContent>
          </Popover>
        </InputGroupAddon>
      </InputGroup>
      {tags.length > 0 && (
        <div className="scrollbar-none scroll-fade-x scroll-fade-4 min-w-0 overflow-x-auto pb-1">
          <ToggleGroup
            aria-label="Quick tag filters"
            variant="tag-filter"
            multiple
            value={selectedTags}
            onValueChange={onTagsChange}
            spacing={1}
          >
            {tags.map((tag) => (
              <ToggleGroupItem key={tag} value={tag} title={tag}>
                <span className="max-w-36 truncate">#{tag}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
      {selectedTags.length > 0 && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Filtering:{' '}
          <span className="font-mono text-primary">
            {selectedTags.map((tag) => `#${tag}`).join(' + ')}
          </span>
        </p>
      )}
      {favoritesOnly && (
        <Button variant="ghost" size="xs" className="w-fit" onClick={onToggleFavorites}>
          <Star data-icon="inline-start" /> Favorites only <X data-icon="inline-end" />
        </Button>
      )}
    </div>
  );
}

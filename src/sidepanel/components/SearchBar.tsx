import { Search, X } from 'lucide-react';
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from '@/components/ui/input-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

export function SearchBar({ value, onChange, tags, selectedTag, onSelectTag }: SearchBarProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          aria-label="Search skills"
          placeholder="Search skills, shortcuts, or tags…"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {value && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => onChange('')}>
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
      {tags.length > 0 && (
        <div className="overflow-x-auto pb-1">
          <ToggleGroup
            aria-label="Filter by tag"
            value={[selectedTag ?? '']}
            onValueChange={(values) => onSelectTag(values[0] || null)}
            size="sm"
            variant="outline"
            spacing={1}
          >
            <ToggleGroupItem value="">All tags</ToggleGroupItem>
            {tags.map((tag) => (
              <ToggleGroupItem key={tag} value={tag}>
                #{tag}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  tags,
  selectedTag,
  onSelectTag,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="search-wrapper">
        <Search className="search-icon" size={16} />
        <input
          type="text"
          className="search-input"
          placeholder="Search skills, /shortcuts, or tags..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#9CA3AF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {tags.length > 0 && (
        <div className="tags-row">
          <button
            className={`tag-pill ${selectedTag === null ? 'active' : ''}`}
            onClick={() => onSelectTag(null)}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              className={`tag-pill ${selectedTag === tag ? 'active' : ''}`}
              onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

import { Skill, SkillSearchResult } from '../../domain/types';
import { PALETTE_STYLES } from './styles';

export interface PaletteOptions {
  onSelect: (skill: Skill) => void;
  onClose: () => void;
}

export class PaletteUI {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private container: HTMLElement | null = null;
  private results: SkillSearchResult[] = [];
  private selectedIndex = 0;
  private options: PaletteOptions;
  private isOpen = false;

  constructor(options: PaletteOptions) {
    this.options = options;
  }

  private ensureHost(): ShadowRoot {
    if (!this.host) {
      this.host = document.createElement('skill-vault-root');
      document.documentElement.appendChild(this.host);
      this.shadow = this.host.attachShadow({ mode: 'open' });

      const styleEl = document.createElement('style');
      styleEl.textContent = PALETTE_STYLES;
      this.shadow.appendChild(styleEl);

      this.container = document.createElement('div');
      this.shadow.appendChild(this.container);
    }
    return this.shadow!;
  }

  open(composerEl: HTMLElement, query: string, results: SkillSearchResult[]) {
    this.ensureHost();
    this.results = results.slice(0, 8);
    this.selectedIndex = 0;
    this.isOpen = true;

    this.render(query);
    this.position(composerEl);
  }

  update(query: string, results: SkillSearchResult[]) {
    if (!this.isOpen) return;
    this.results = results.slice(0, 8);
    this.selectedIndex = 0;
    this.render(query);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.container) {
      this.container.innerHTML = '';
    }
    if (this.host && this.host.parentElement) {
      this.host.parentElement.removeChild(this.host);
      this.host = null;
      this.shadow = null;
      this.container = null;
    }
    this.options.onClose();
  }

  isPaletteOpen(): boolean {
    return this.isOpen;
  }

  handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return true;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (this.results.length > 0) {
        this.selectedIndex = (this.selectedIndex + 1) % this.results.length;
        this.updateSelection();
      }
      return true;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (this.results.length > 0) {
        this.selectedIndex = (this.selectedIndex - 1 + this.results.length) % this.results.length;
        this.updateSelection();
      }
      return true;
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      if (this.results.length > 0 && this.results[this.selectedIndex]) {
        e.preventDefault();
        e.stopPropagation();
        const selected = this.results[this.selectedIndex].skill;
        this.options.onSelect(selected);
        this.close();
        return true;
      }
    }

    return false;
  }

  private position(composerEl: HTMLElement) {
    if (!this.host) return;

    const rect = composerEl.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Default: position 8px above the composer element
    const paletteHeight = 360;
    let top = rect.top + scrollY - paletteHeight - 12;

    if (top < scrollY + 10) {
      // If not enough room above, place below composer
      top = rect.bottom + scrollY + 8;
    }

    let left = rect.left + scrollX;
    if (left + 380 > window.innerWidth) {
      left = Math.max(10, window.innerWidth - 390);
    }

    this.host.style.top = `${Math.max(10, top)}px`;
    this.host.style.left = `${Math.max(10, left)}px`;
  }

  private render(query: string) {
    if (!this.container) return;

    const searchLabel = query
      ? `Filtering: <strong>"${this.escapeHtml(query)}"</strong>`
      : 'Type skill name or shortcut';

    let listHtml: string;
    if (this.results.length === 0) {
      listHtml = `
        <div class="sv-empty">
          No skills found matching "${this.escapeHtml(query)}"
          <div class="sv-empty-hint">Create new skills in the Side Panel</div>
        </div>
      `;
    } else {
      listHtml = this.results
        .map(({ skill }, idx) => {
          const isSelected = idx === this.selectedIndex;
          const shortcutBadge = skill.shortcut
            ? `<span class="sv-shortcut-badge">/${this.escapeHtml(skill.shortcut)}</span>`
            : '';
          const favBadge = skill.favorite ? `<span class="sv-fav-star">★</span>` : '';
          const tagsHtml = (skill.tags || [])
            .slice(0, 3)
            .map((t) => `<span class="sv-tag">#${this.escapeHtml(t)}</span>`)
            .join('');

          return `
            <li class="sv-item ${isSelected ? 'selected' : ''}" data-index="${idx}" role="option" aria-selected="${isSelected}">
              <div class="sv-item-title-row">
                <span class="sv-item-name">${favBadge} ${this.escapeHtml(skill.name)}</span>
                ${shortcutBadge}
              </div>
              ${skill.description ? `<div class="sv-item-desc">${this.escapeHtml(skill.description)}</div>` : ''}
              ${tagsHtml ? `<div class="sv-item-tags">${tagsHtml}</div>` : ''}
            </li>
          `;
        })
        .join('');
    }

    this.container.innerHTML = `
      <div class="sv-palette" role="listbox" aria-label="Skill Vault Palette">
        <div class="sv-header">
          <span class="sv-logo-badge">⚡ Skill Vault</span>
          <span class="sv-search-indicator">${searchLabel}</span>
        </div>
        <ul class="sv-list">
          ${listHtml}
        </ul>
        <div class="sv-footer">
          <div class="sv-hints">
            <span><span class="sv-kbd">↑</span><span class="sv-kbd">↓</span> navigate</span>
            <span><span class="sv-kbd">↵</span> insert</span>
            <span><span class="sv-kbd">esc</span> close</span>
          </div>
          <span>${this.results.length} results</span>
        </div>
      </div>
    `;

    // Attach click listeners to items
    const items = this.container.querySelectorAll('.sv-item');
    items.forEach((itemEl) => {
      itemEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(itemEl.getAttribute('data-index') || '0', 10);
        if (this.results[idx]) {
          const selected = this.results[idx].skill;
          this.options.onSelect(selected);
          this.close();
        }
      });
    });
  }

  private updateSelection() {
    if (!this.container) return;
    const items = this.container.querySelectorAll('.sv-item');
    items.forEach((itemEl, idx) => {
      if (idx === this.selectedIndex) {
        itemEl.classList.add('selected');
        itemEl.setAttribute('aria-selected', 'true');
        itemEl.scrollIntoView({ block: 'nearest' });
      } else {
        itemEl.classList.remove('selected');
        itemEl.setAttribute('aria-selected', 'false');
      }
    });
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

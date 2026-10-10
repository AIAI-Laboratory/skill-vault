import { DEFAULT_SETTINGS, Skill, SkillSearchResult, SkillVaultSettings } from '../../domain/types';
import { PALETTE_STYLES } from './styles';
import { getPalettePosition } from './position';

export interface PaletteOptions {
  onSelect: (skill: Skill) => void;
  onClose: () => void;
  onSearch: (query: string) => Promise<SkillSearchResult[]>;
}

const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const layersIcon = svg(
  '<path d="m12 3 10 5-10 5L2 8z"/><path d="m2 12 10 5 10-5M2 16l10 5 10-5"/>'
);
const searchIcon = svg('<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>');
const closeIcon = svg('<path d="m6 6 12 12M6 18 18 6"/>');
const insertIcon = svg('<path d="M19 5v8a2 2 0 0 1-2 2H5m4-4-4 4 4 4"/>');
const starIcon = svg(
  '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>'
);

export class PaletteUI {
  private host: HTMLElement | null = null;
  private container: HTMLElement | null = null;
  private composer: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private results: SkillSearchResult[] = [];
  private selectedIndex = 0;
  private theme: SkillVaultSettings['theme'] = DEFAULT_SETTINGS.theme;
  private isOpen = false;
  private label: string | null = null;
  private searchRevision = 0;

  constructor(private options: PaletteOptions) {}

  setTheme(theme: SkillVaultSettings['theme']) {
    this.theme = theme;
    this.host?.setAttribute('data-theme', theme);
  }

  private ensureHost() {
    if (this.host) return;
    this.host = document.createElement('skill-vault-root');
    this.host.setAttribute('data-theme', this.theme);
    document.documentElement.appendChild(this.host);
    const shadow = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = PALETTE_STYLES;
    shadow.appendChild(style);
    this.container = document.createElement('div');
    shadow.appendChild(this.container);
    // Preserve the chat's caret/selection when an option is clicked.
    this.container.addEventListener('mousedown', (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('.sv-search-input'))
        event.preventDefault();
    });
  }

  /**
   * @param label Optional text shown instead of the search line (used by the template picker).
   */
  open(composer: HTMLElement, query: string, results: SkillSearchResult[], label?: string) {
    if (this.isOpen) this.close();
    this.ensureHost();
    this.composer = composer;
    this.label = label ?? null;
    this.results = label ? results : results.slice(0, 8);
    this.selectedIndex = 0;
    this.isOpen = true;
    this.render(query);
    this.container?.querySelector<HTMLInputElement>('.sv-search-input')?.focus();
    this.position();
    if (!this.isOpen) return;
    window.addEventListener('resize', this.reposition);
    window.addEventListener('scroll', this.reposition, true);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.position());
      this.resizeObserver.observe(composer);
    }
  }

  update(query: string, results: SkillSearchResult[]) {
    if (!this.isOpen) return;
    this.results = results.slice(0, 8);
    this.selectedIndex = 0;
    const input = this.container?.querySelector<HTMLInputElement>('.sv-search-input');
    const restoreFocus = input === this.host?.shadowRoot?.activeElement;
    const caret = input?.selectionStart ?? query.length;
    this.render(query);
    const nextInput = this.container?.querySelector<HTMLInputElement>('.sv-search-input');
    if (restoreFocus && nextInput) {
      nextInput.focus();
      nextInput.setSelectionRange(caret, caret);
    }
    this.position();
  }

  close() {
    if (!this.isOpen) return;
    this.searchRevision++;
    this.isOpen = false;
    window.removeEventListener('resize', this.reposition);
    window.removeEventListener('scroll', this.reposition, true);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.host?.remove();
    this.host = null;
    this.container = null;
    this.composer = null;
    this.options.onClose();
  }

  isPaletteOpen(): boolean {
    return this.isOpen;
  }

  hasFocus(): boolean {
    return document.activeElement === this.host;
  }

  handleKeyDown(event: KeyboardEvent): boolean {
    if (!this.isOpen || event.isComposing) return false;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return true;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      if (this.results.length) {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        this.selectedIndex =
          (this.selectedIndex + direction + this.results.length) % this.results.length;
        this.updateSelection(true);
      }
      return true;
    }
    if ((event.key === 'Enter' || event.key === 'Tab') && this.results[this.selectedIndex]) {
      event.preventDefault();
      event.stopPropagation();
      this.select(this.selectedIndex);
      return true;
    }
    return false;
  }

  private select(index: number) {
    const result = this.results[index];
    if (!result) return;
    this.options.onSelect(result.skill);
    this.close();
  }

  private reposition = (event: Event) => {
    // Scrolling the results must not move the page or reset the popup height.
    if (this.host && event.composedPath().includes(this.host)) return;
    this.position();
  };

  private position() {
    if (!this.host || !this.composer || !this.container) return;
    const rect = this.composer.getBoundingClientRect();
    if (!this.composer.isConnected || rect.bottom < 0 || rect.top > window.innerHeight) {
      this.close();
      return;
    }
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    this.host.style.width = `${Math.max(0, Math.min(380, viewport.width - 24))}px`;
    this.host.style.setProperty('--sv-max-height', '420px');
    const height = this.container.getBoundingClientRect().height || 420;
    const bounds = getPalettePosition(rect, viewport, height);
    this.host.style.top = `${bounds.top}px`;
    this.host.style.left = `${bounds.left}px`;
    this.host.style.setProperty('--sv-max-height', `${bounds.maxHeight}px`);
  }

  private render(query: string) {
    if (!this.container) return;
    const searchLabel = this.label ? this.escapeHtml(this.label) : null;
    const listHtml = this.results
      .map(
        ({ skill }, index) => `
      <li id="sv-option-${index}" class="sv-item ${index === this.selectedIndex ? 'selected' : ''}" data-index="${index}" role="option" aria-selected="${index === this.selectedIndex}">
        <div class="sv-item-body">
          <div class="sv-item-title-row">
            ${skill.favorite ? `<span class="sv-fav-star" aria-label="Favorite">${starIcon}</span>` : ''}
            <span class="sv-item-name">${this.highlight(skill.name, query)}</span>
            ${skill.shortcut ? `<span class="sv-shortcut-badge">/${this.escapeHtml(skill.shortcut)}</span>` : ''}
          </div>
          ${skill.description ? `<p class="sv-item-desc">${this.highlight(skill.description, query)}</p>` : ''}
          ${
            skill.tags.length
              ? `<div class="sv-item-tags">${skill.tags
                  .slice(0, 3)
                  .map((tag) => `<span class="sv-tag">${this.highlight(tag, query)}</span>`)
                  .join('')}</div>`
              : ''
          }
        </div>
        <span class="sv-insert-icon">${insertIcon}</span>
      </li>
    `
      )
      .join('');

    this.container.innerHTML = `
      <section class="sv-palette" aria-label="Skill Vault">
        <header class="sv-header">
          ${
            searchLabel
              ? `<div class="sv-search sv-search-label">${searchIcon}<span class="sv-search-text">${searchLabel}</span></div>`
              : `<label class="sv-search">${searchIcon}<input class="sv-search-input" type="text" aria-label="Search skills" placeholder="Find a skill by name, description, or tag…" value="${this.escapeHtml(query)}"></label>`
          }
          <button class="sv-close" type="button" aria-label="Close skill palette" title="Close (Esc)">${closeIcon}</button>
        </header>
        ${this.results.length ? `<ul class="sv-list" role="listbox" aria-label="Skills" aria-activedescendant="sv-option-${this.selectedIndex}">${listHtml}</ul>` : this.label ? `<div class="sv-empty" role="status"><div class="sv-empty-icon">${layersIcon}</div><p class="sv-empty-title">No fillable templates yet</p><p class="sv-empty-hint">Add {user_input} to a skill's prompt in the Skill Vault side panel, then try again.</p></div>` : `<div class="sv-empty" role="status"><div class="sv-empty-icon">${searchIcon}</div><p class="sv-empty-title">${query ? 'No matching skills' : 'Your library starts here'}</p><p class="sv-empty-hint">${query ? `Try another name or tag for “${this.escapeHtml(query)}”.` : 'Create your first skill in the Skill Vault side panel.'}</p></div>`}
        <footer class="sv-footer"><div class="sv-hints"><span><kbd class="sv-kbd">↑ ↓</kbd> navigate</span><span><kbd class="sv-kbd">↵</kbd> insert</span><span><kbd class="sv-kbd">esc</kbd> close</span></div></footer>
      </section>
    `;
    this.container.querySelector('.sv-close')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    });
    this.container
      .querySelector<HTMLInputElement>('.sv-search-input')
      ?.addEventListener('input', (event) => {
        const value = (event.currentTarget as HTMLInputElement).value;
        const revision = ++this.searchRevision;
        void this.options.onSearch(value).then((results) => {
          if (this.isOpen && revision === this.searchRevision) this.update(value, results);
        });
      });
    this.container
      .querySelector<HTMLInputElement>('.sv-search-input')
      ?.addEventListener('keydown', (event) => {
        if (event.isComposing) return;
        if (
          event.key === 'Escape' ||
          event.key === 'ArrowDown' ||
          event.key === 'ArrowUp' ||
          event.key === 'Enter' ||
          event.key === 'Tab'
        ) {
          if (this.handleKeyDown(event)) event.stopPropagation();
        }
      });
    this.container.querySelectorAll<HTMLElement>('.sv-item').forEach((item, index) => {
      item.addEventListener('mousemove', () => {
        if (index === this.selectedIndex) return;
        this.selectedIndex = index;
        this.updateSelection(false);
      });
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.select(index);
      });
    });
  }

  private updateSelection(scroll: boolean) {
    if (!this.container) return;
    const list = this.container.querySelector<HTMLElement>('.sv-list');
    list?.setAttribute('aria-activedescendant', `sv-option-${this.selectedIndex}`);
    this.container.querySelectorAll<HTMLElement>('.sv-item').forEach((item, index) => {
      const selected = index === this.selectedIndex;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-selected', String(selected));
      if (selected && scroll && list) {
        const itemRect = item.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();
        if (itemRect.top < listRect.top) list.scrollTop -= listRect.top - itemRect.top;
        else if (itemRect.bottom > listRect.bottom)
          list.scrollTop += itemRect.bottom - listRect.bottom;
      }
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private highlight(value: string, query: string): string {
    const term = query.trim().replace(/^\//, '');
    if (!term) return this.escapeHtml(value);
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return value
      .split(new RegExp(`(${escapedTerm})`, 'gi'))
      .map((part) =>
        part.toLowerCase() === term.toLowerCase()
          ? `<mark class="sv-match">${this.escapeHtml(part)}</mark>`
          : this.escapeHtml(part)
      )
      .join('');
  }
}

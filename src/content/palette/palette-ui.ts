import { DEFAULT_SETTINGS, Skill, SkillSearchResult, SkillVaultSettings } from '../../domain/types';
import { SKILL_DRAG_TYPE } from '../../infrastructure/messaging/protocol';
import { PALETTE_STYLES } from './styles';
import { getPalettePosition } from './position';

export interface PaletteOptions {
  onSelect: (skill: Skill) => void;
  onClose: () => void;
  onSearch: (query: string) => Promise<SkillSearchResult[]>;
  onCopy?: (skill: Skill) => void;
  onDragDrop?: (skill: Skill) => void;
}

const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const layersIcon = svg(
  '<path d="m12 3 10 5-10 5L2 8z"/><path d="m2 12 10 5 10-5M2 16l10 5 10-5"/>'
);
const searchIcon = svg('<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>');
const closeIcon = svg('<path d="m6 6 12 12M6 18 18 6"/>');
const insertIcon = svg('<path d="M19 5v8a2 2 0 0 1-2 2H5m4-4-4 4 4 4"/>');
const copyIcon = svg(
  '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'
);
const checkIcon = svg('<path d="M20 6 9 17l-5-5"/>');
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
  private dragging = false;
  private pointerDownOnItem = false;
  private copyTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

  /**
   * Resets the pending item pointer-down flag once a mouse press or drag finishes.
   */
  private clearPointerDown = (): void => {
    this.pointerDownOnItem = false;
  };

  constructor(private options: PaletteOptions) {}

  setTheme(theme: SkillVaultSettings['theme']) {
    this.theme = theme;
    this.host?.setAttribute('data-theme', theme);
  }

  /**
   * Lazily creates the Shadow DOM host and attaches focus-preserving mousedown handling.
   */
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
    // Preserve the chat's caret/selection on palette chrome clicks while allowing native
    // drag-and-drop to start on draggable skill items.
    this.container.addEventListener(
      'mousedown',
      /**
       * Prevents focus loss on palette chrome while allowing search focus and item dragging.
       *
       * @param event - Mouse down event originating inside the palette container.
       */
      (event) => {
        if (!(event.target instanceof Element)) {
          event.preventDefault();
          return;
        }
        if (event.target.closest('.sv-search-input')) return;
        if (event.target.closest('.sv-item') && !event.target.closest('button')) {
          this.pointerDownOnItem = true;
          return;
        }
        event.preventDefault();
      }
    );
  }

  /**
   * Opens the palette anchored to the given composer element.
   *
   * @param composer - The active composer element used as positioning anchor.
   * @param query - Initial search query text.
   * @param results - Initial list of matching skills to display.
   * @param label - Optional text shown instead of the search input (used by the template picker).
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
    window.addEventListener('mouseup', this.clearPointerDown);
    window.addEventListener('dragend', this.clearPointerDown);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(
        /** Repositions the palette whenever the anchored composer resizes. */
        () => this.position()
      );
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

  /**
   * Closes the palette, tears down DOM listeners and timers, and notifies listeners.
   */
  close() {
    if (!this.isOpen) return;
    this.searchRevision++;
    this.isOpen = false;
    this.dragging = false;
    this.pointerDownOnItem = false;
    this.clearCopyTimers();
    window.removeEventListener('resize', this.reposition);
    window.removeEventListener('scroll', this.reposition, true);
    window.removeEventListener('mouseup', this.clearPointerDown);
    window.removeEventListener('dragend', this.clearPointerDown);
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

  /**
   * Reports whether the user is currently pressing or dragging a palette skill item.
   *
   * @returns True while a pointer press or drag gesture on a skill item is active.
   */
  isInteracting(): boolean {
    return this.dragging || this.pointerDownOnItem;
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

  /**
   * Renders the palette markup for the current results and attaches item interaction handlers.
   *
   * @param query - Current search query used for highlighting and populating the search input.
   */
  private render(query: string) {
    if (!this.container) return;
    this.clearCopyTimers();
    const searchLabel = this.label ? this.escapeHtml(this.label) : null;
    const listHtml = this.results
      .map(
        /**
         * Formats a single search result as a draggable, selectable listbox option.
         *
         * @param result - Search result containing the skill to render.
         * @param index - Zero-based position of the option in the rendered list.
         * @returns HTML markup for the skill option row.
         */
        ({ skill }, index) => `
      <li id="sv-option-${index}" class="sv-item ${index === this.selectedIndex ? 'selected' : ''}" data-index="${index}" draggable="true" role="option" aria-selected="${index === this.selectedIndex}" title="Click to insert or drag into any text input">
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
                  .map(
                    /**
                     * Formats a highlighted skill tag pill.
                     *
                     * @param tag - Tag string associated with the skill.
                     * @returns HTML markup for the tag pill.
                     */
                    (tag) => `<span class="sv-tag">${this.highlight(tag, query)}</span>`
                  )
                  .join('')}</div>`
              : ''
          }
        </div>
        <div class="sv-item-actions">
          <button class="sv-copy-btn" type="button" aria-label="Copy ${this.escapeHtml(skill.name)}" title="Copy prompt">${copyIcon}</button>
          <span class="sv-insert-icon">${insertIcon}</span>
        </div>
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
    this.container.querySelector('.sv-close')?.addEventListener(
      'click',
      /**
       * Closes the palette when the header close button is clicked.
       *
       * @param event - Click event from the close button.
       */
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.close();
      }
    );
    this.container.querySelector<HTMLInputElement>('.sv-search-input')?.addEventListener(
      'input',
      /**
       * Re-queries skills as the user types in the palette search input.
       *
       * @param event - Input event from the search field.
       */
      (event) => {
        const value = (event.currentTarget as HTMLInputElement).value;
        const revision = ++this.searchRevision;
        void this.options.onSearch(value).then(
          /**
           * Applies the latest search results when the request revision is still current.
           *
           * @param results - Matching skills returned by the search handler.
           */
          (results) => {
            if (this.isOpen && revision === this.searchRevision) this.update(value, results);
          }
        );
      }
    );
    this.container.querySelector<HTMLInputElement>('.sv-search-input')?.addEventListener(
      'keydown',
      /**
       * Routes palette navigation and selection keys from the search input.
       *
       * @param event - Keyboard event from the search field.
       */
      (event) => {
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
      }
    );
    this.container.querySelectorAll<HTMLElement>('.sv-item').forEach(
      /**
       * Attaches hover, click, copy, and drag-and-drop listeners to a rendered skill option.
       *
       * @param item - Rendered list item element for the skill.
       * @param index - Zero-based index of the skill in `this.results`.
       */
      (item, index) => {
        item.addEventListener(
          'mousemove',
          /** Highlights the hovered option as the active selection. */
          () => {
            if (index === this.selectedIndex) return;
            this.selectedIndex = index;
            this.updateSelection(false);
          }
        );
        item.addEventListener(
          'click',
          /**
           * Inserts the clicked skill unless the click targeted an inline action button.
           *
           * @param event - Click event from the skill row.
           */
          (event) => {
            if (event.target instanceof Element && event.target.closest('button')) return;
            event.preventDefault();
            event.stopPropagation();
            this.select(index);
          }
        );
        item.addEventListener(
          'dragstart',
          /**
           * Populates drag payloads with both the Skill Vault ID and plain-text prompt content
           * so skills can be dropped into AI composers or any browser text input.
           *
           * @param event - Drag start event initiated on the skill row.
           */
          (event) => {
            if (event.target instanceof Element && event.target.closest('button')) {
              event.preventDefault();
              return;
            }
            const skill = this.results[index]?.skill;
            if (!skill || !event.dataTransfer) return;
            this.dragging = true;
            item.classList.add('dragging');
            event.dataTransfer.setData(SKILL_DRAG_TYPE, skill.id);
            event.dataTransfer.setData('text/plain', skill.content);
            event.dataTransfer.effectAllowed = 'copy';
          }
        );
        item.addEventListener(
          'dragend',
          /**
           * Clears drag state and closes the palette when a skill was dropped onto a target.
           *
           * @param event - Drag end event fired after the drag gesture finishes.
           */
          (event) => {
            this.dragging = false;
            this.pointerDownOnItem = false;
            item.classList.remove('dragging');
            const skill = this.results[index]?.skill;
            if (event.dataTransfer && event.dataTransfer.dropEffect !== 'none' && this.isOpen) {
              if (skill) this.options.onDragDrop?.(skill);
              this.close();
            }
          }
        );
        const copyButton = item.querySelector<HTMLButtonElement>('.sv-copy-btn');
        copyButton?.addEventListener(
          'click',
          /**
           * Copies the skill's prompt content without inserting or closing the palette.
           *
           * @param event - Click event from the copy button.
           */
          (event) => {
            event.preventDefault();
            event.stopPropagation();
            const skill = this.results[index]?.skill;
            if (skill) void this.copySkill(skill, copyButton);
          }
        );
      }
    );
  }

  /**
   * Copies a skill's prompt content to the clipboard and temporarily shows a checkmark state.
   *
   * @param skill - The skill whose prompt content should be copied.
   * @param button - The copy button element to update with visual confirmation.
   * @returns A promise that resolves once the clipboard attempt finishes.
   */
  private async copySkill(skill: Skill, button: HTMLButtonElement): Promise<void> {
    const copied = await this.writeToClipboard(skill.content);
    if (!copied || !button.isConnected) return;
    button.classList.add('copied');
    button.innerHTML = checkIcon;
    button.setAttribute('title', 'Copied');
    button.setAttribute('aria-label', `Copied ${skill.name}`);
    this.options.onCopy?.(skill);
    const existing = this.copyTimers.get(button);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(
      /** Restores the copy button icon and accessibility labels after confirmation. */
      () => {
        this.copyTimers.delete(button);
        if (!button.isConnected) return;
        button.classList.remove('copied');
        button.innerHTML = copyIcon;
        button.setAttribute('title', 'Copy prompt');
        button.setAttribute('aria-label', `Copy ${skill.name}`);
      },
      1500
    );
    this.copyTimers.set(button, timer);
  }

  /**
   * Writes text to the system clipboard, falling back to a temporary textarea when the
   * async Clipboard API is unavailable or denied.
   *
   * @param text - Plain text content to place on the clipboard.
   * @returns A promise resolving to true when the text was copied successfully.
   */
  private async writeToClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fall back to execCommand when the async Clipboard API is blocked.
      }
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  }

  /**
   * Cancels all pending copy-confirmation reset timers.
   */
  private clearCopyTimers(): void {
    for (const timer of this.copyTimers.values()) clearTimeout(timer);
    this.copyTimers.clear();
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

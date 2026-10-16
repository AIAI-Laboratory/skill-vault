import { AdapterRegistry } from '../adapters/registry';
import { AIAdapter, ComposerHandle, TextRange } from '../adapters/types';
import { PageContext, Skill, SkillVaultSettings } from '../domain/types';
import { fillUserInput, hasUserInputSlot, renderPromptTemplate } from '../domain/variable';
import { sendExtensionMessage } from '../infrastructure/messaging/client';
import { FILL_SELECTION_MESSAGE, FillSelectionMessage } from '../infrastructure/messaging/protocol';
import { parseSlashCommand } from './slash/parser';
import { PaletteUI } from './palette/palette-ui';
import { getSkillLabel, SKILL_DRAG_TYPE } from '../infrastructure/skill-drag';

export class ContentRuntime {
  private registry = AdapterRegistry.getInstance();
  private activeAdapter: AIAdapter | null = null;
  private currentComposer: ComposerHandle | null = null;
  private palette: PaletteUI;
  private activeSlashRange: TextRange | null = null;
  private disposeObserver: (() => void) | null = null;
  private disposed = false;
  private settingsRevision = 0;
  private blurTimer: ReturnType<typeof setTimeout> | undefined;
  /** Composer selection captured on right-click, before the context menu is used. */
  private capturedSelection: { element: HTMLElement; range: TextRange; text: string } | null = null;
  /** Set while the template picker is open for "Fill selection into Skill". */
  private pendingFill: { range: TextRange | null; text: string } | null = null;
  private skillLabels = new Map<string, string>();
  private dropTarget: HTMLElement | null = null;
  private dropStyle: HTMLStyleElement | null = null;

  private resolveDropComposer(event: DragEvent): ComposerHandle | null {
    const types = event.dataTransfer?.types ?? [];
    if (
      !this.activeAdapter ||
      !types.includes(SKILL_DRAG_TYPE) ||
      types.includes('Files') ||
      event.dataTransfer!.files.length > 0
    )
      return null;
    let composer = this.resolveComposer(event.target);
    // Custom sites may have multiple inputs; dropping chooses the target without stealing focus.
    if (!composer && this.activeAdapter.id === 'generic' && event.target instanceof Element) {
      const element = event.target.closest<HTMLElement>('textarea, [contenteditable="true"]');
      if (element)
        composer = {
          element,
          kind: element.tagName === 'TEXTAREA' ? 'textarea' : 'contenteditable',
          adapterId: 'generic',
        };
    }
    if (
      composer?.element.matches(
        ':disabled, [readonly], [aria-disabled="true"], [aria-readonly="true"]'
      )
    )
      return null;
    return composer;
  }

  private clearDropTarget = () => {
    this.dropTarget?.removeAttribute('data-skill-vault-drop-target');
    this.dropTarget = null;
  };

  private onDocumentDragOver = (event: DragEvent) => {
    const composer = this.resolveDropComposer(event);
    if (!composer) {
      this.clearDropTarget();
      return;
    }
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
    if (this.dropTarget === composer.element) return;
    this.clearDropTarget();
    if (!this.dropStyle) {
      this.dropStyle = document.createElement('style');
      this.dropStyle.textContent =
        '[data-skill-vault-drop-target] { outline: 2px solid #ff9757 !important; outline-offset: 3px !important; }';
      document.head.appendChild(this.dropStyle);
    }
    this.dropTarget = composer.element;
    this.dropTarget.setAttribute('data-skill-vault-drop-target', '');
  };

  private onDocumentDragLeave = (event: DragEvent) => {
    if (!(event.relatedTarget instanceof Node) || !this.dropTarget?.contains(event.relatedTarget))
      this.clearDropTarget();
  };

  private onDocumentDrop = (event: DragEvent) => {
    const composer = this.resolveDropComposer(event);
    this.clearDropTarget();
    if (!composer || !this.activeAdapter) return;
    event.preventDefault();
    // Prevent the chat site from also inserting plain text or treating this as a file upload.
    event.stopImmediatePropagation();
    const id = event.dataTransfer!.getData(SKILL_DRAG_TYPE);
    if (!id || id.length > 256) return;
    void this.insertDroppedSkill(id, composer, this.activeAdapter);
  };

  private async insertDroppedSkill(id: string, composer: ComposerHandle, adapter: AIAdapter) {
    try {
      // Read from the vault rather than trusting prompt content supplied by a drag payload.
      const skill = await sendExtensionMessage('SKILL_GET', { id });
      if (
        !skill ||
        this.disposed ||
        this.activeAdapter !== adapter ||
        !composer.element.isConnected
      )
        return;
      this.palette.close();
      this.activeSlashRange = null;
      this.currentComposer = composer;
      // Preserve existing chat text; the shared selection flow replaces a trailing /skill command.
      this.placeCaretAtEnd(composer);
      await this.handleSkillSelected(skill, true);
    } catch (error) {
      if (!this.stopIfExtensionContextInvalidated(error))
        console.warn('[SkillVault] Failed to drop skill:', error);
    }
  }

  private onDocumentContextMenu = (e: MouseEvent) => {
    this.capturedSelection = null;
    const composer = this.resolveComposer(e.target);
    if (!composer) return;
    const el = composer.element;
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? start;
      if (start !== end)
        this.capturedSelection = {
          element: el,
          range: { start, end },
          text: el.value.slice(start, end),
        };
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return;
    // Text offsets measured the same way adapters' selectRange walks text nodes.
    const before = document.createRange();
    before.selectNodeContents(el);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    const text = range.toString();
    this.capturedSelection = { element: el, range: { start, end: start + text.length }, text };
  };

  private onRuntimeMessage = (message: unknown) => {
    const msg = message as Partial<FillSelectionMessage> | undefined;
    if (msg?.type === FILL_SELECTION_MESSAGE && typeof msg.selectionText === 'string') {
      void this.handleFillSelection(msg.selectionText);
    }
  };

  /**
   * Returns the composer that owns the event target. Re-queries the adapter when the
   * cached element was replaced, since sites like ChatGPT re-mount their editor.
   */
  private resolveComposer(target: EventTarget | null): ComposerHandle | null {
    if (!this.activeAdapter || !(target instanceof Node)) return null;
    const cached = this.currentComposer;
    if (cached?.element.isConnected && cached.element.contains(target)) return cached;
    const found = this.activeAdapter.findComposer();
    if (found && found.element.contains(target)) {
      this.currentComposer = found;
      return found;
    }
    return null;
  }

  private onDocumentInput = (e: Event) => {
    if (this.resolveComposer(e.target)) void this.handleInput();
  };

  private onDocumentKeyDown = (e: KeyboardEvent) => {
    if (this.palette.isPaletteOpen() && this.resolveComposer(e.target)) {
      if (this.palette.handleKeyDown(e)) e.stopPropagation();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && this.resolveComposer(e.target))
      this.expandSkillLabels();
  };

  private onDocumentSubmit = () => this.expandSkillLabels();

  private onDocumentClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLElement>('button, [role="button"]');
    if (!button) return;
    const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${button.getAttribute('data-testid') || ''} ${button.textContent || ''}`;
    if (/\b(send|submit)\b/i.test(label)) this.expandSkillLabels();
  };

  private expandSkillLabels() {
    const adapter = this.activeAdapter;
    if (!adapter || !this.skillLabels.size) return;
    const composer = adapter.findComposer();
    if (!composer) return;
    // Adapter ranges count DOM text nodes, while innerText may collapse newlines or add
    // block separators. Use the same offsets when locating compact labels to expand.
    const text =
      composer.kind === 'textarea' ? adapter.readComposer() : (composer.element.textContent ?? '');
    const replacements: { start: number; end: number; prompt: string }[] = [];
    for (const [label, prompt] of this.skillLabels) {
      let start = text.indexOf(label);
      while (start !== -1) {
        replacements.push({ start, end: start + label.length, prompt });
        start = text.indexOf(label, start + label.length);
      }
    }
    replacements.sort((a, b) => b.start - a.start);
    for (const replacement of replacements) {
      void adapter
        .insertText(replacement.prompt, { start: replacement.start, end: replacement.end }, 'plain')
        .catch((error) => console.warn('[SkillVault] Failed to expand skill label:', error));
    }
  }

  private onDocumentFocusOut = (e: FocusEvent) => {
    if (!this.currentComposer?.element.contains(e.target as Node)) return;
    // Delay closing to allow click events inside palette to register
    clearTimeout(this.blurTimer);
    this.blurTimer = setTimeout(() => {
      if (this.palette.isPaletteOpen() && !this.palette.hasFocus()) this.palette.close();
    }, 250);
  };

  private handleSettingsChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string
  ) => {
    if (area !== 'local') return;
    const settings = changes.settings?.newValue as SkillVaultSettings | undefined;
    if (settings) {
      this.settingsRevision++;
      this.applySettings(settings);
    }
  };

  constructor() {
    this.palette = new PaletteUI({
      onSelect: (skill) => {
        const fill = this.pendingFill;
        if (fill) void this.applyFill(skill, fill.text, fill.range);
        else void this.handleSkillSelected(skill);
      },
      onSearch: async (query) => {
        try {
          return await sendExtensionMessage('SKILL_SEARCH', { query });
        } catch (error) {
          if (!this.stopIfExtensionContextInvalidated(error))
            console.warn('[SkillVault] Failed to search skills:', error);
          return [];
        }
      },
      onClose: () => {
        this.activeSlashRange = null;
        this.pendingFill = null;
      },
    });
  }

  init() {
    this.disposed = false;
    chrome.storage?.onChanged?.addListener(this.handleSettingsChange);
    // Capture phase on document: runs before the site's editor handlers and survives
    // composer re-mounts.
    document.addEventListener('input', this.onDocumentInput, true);
    document.addEventListener('keydown', this.onDocumentKeyDown, true);
    document.addEventListener('submit', this.onDocumentSubmit, true);
    document.addEventListener('click', this.onDocumentClick, true);
    document.addEventListener('focusout', this.onDocumentFocusOut, true);
    document.addEventListener('contextmenu', this.onDocumentContextMenu, true);
    document.addEventListener('dragover', this.onDocumentDragOver, true);
    document.addEventListener('dragleave', this.onDocumentDragLeave, true);
    document.addEventListener('drop', this.onDocumentDrop, true);
    document.addEventListener('dragend', this.clearDropTarget, true);
    chrome.runtime?.onMessage?.addListener(this.onRuntimeMessage);
    const revision = this.settingsRevision;
    void sendExtensionMessage('SETTINGS_GET')
      .then((settings) => {
        if (!this.disposed && revision === this.settingsRevision) this.applySettings(settings);
      })
      .catch((error) => this.stopIfExtensionContextInvalidated(error));
  }

  private stopIfExtensionContextInvalidated(error: unknown) {
    if (!String(error).includes('Extension context invalidated')) return false;
    this.dispose();
    return true;
  }

  private applySettings(settings: SkillVaultSettings) {
    if (this.disposed) return;
    this.palette.setTheme(settings.theme);
    const context: PageContext = {
      url: window.location.href,
      hostname: window.location.hostname,
      title: document.title,
    };
    const adapter = this.registry.getBestAdapter(context, settings);
    if (adapter === this.activeAdapter) return;
    this.disposeObserver?.();
    this.disposeObserver = null;
    this.currentComposer = null;
    this.clearDropTarget();
    this.palette.close();
    this.activeAdapter = adapter;
    if (!this.activeAdapter) return;

    // Track composer swaps so the palette anchors to the live element.
    this.disposeObserver = this.activeAdapter.observeComposer((composer) => {
      this.attachToComposer(composer);
    });
    this.currentComposer = this.activeAdapter.findComposer();
  }

  private attachToComposer(composer: ComposerHandle | null) {
    if (composer?.element === this.currentComposer?.element) return;
    this.currentComposer = composer;
    if (!composer) this.palette.close();
  }

  private async handleInput() {
    if (!this.activeAdapter) return;
    const adapter = this.activeAdapter;

    const caretContext = this.activeAdapter.getCaretContext?.();
    const textBefore = caretContext ? caretContext.textBefore : this.activeAdapter.readComposer();

    const slashResult = parseSlashCommand(textBefore);

    if (slashResult.type === 'skill_palette') {
      this.activeSlashRange = slashResult.range;

      try {
        const results = await sendExtensionMessage('SKILL_SEARCH', { query: slashResult.query });
        if (!this.disposed && this.activeAdapter === adapter && this.currentComposer) {
          if (!this.palette.isPaletteOpen()) {
            this.palette.open(this.currentComposer.element, slashResult.query, results);
          } else {
            this.palette.update(slashResult.query, results);
          }
        }
      } catch (err) {
        if (this.stopIfExtensionContextInvalidated(err)) return;
        console.warn('[SkillVault] Failed to query skills:', err);
      }
    } else {
      if (this.palette.isPaletteOpen()) {
        this.palette.close();
      }
      this.activeSlashRange = null;
    }
  }

  private async handleSkillSelected(skill: Skill, append = false) {
    if (!this.activeAdapter || !this.currentComposer) return;

    // Capture target slash range immediately before it can be cleared
    let targetRange = this.activeSlashRange;

    // Fallback: If targetRange is not set, parse from current composer text
    if (!targetRange) {
      const caretContext = this.activeAdapter.getCaretContext?.();
      const textBefore = caretContext ? caretContext.textBefore : this.activeAdapter.readComposer();
      const parsed = parseSlashCommand(textBefore);
      if (parsed.type === 'skill_palette') {
        targetRange = parsed.range;
      }
    }

    const context: Partial<PageContext> & { provider?: string } = {
      url: window.location.href,
      title: document.title,
      provider: this.activeAdapter.name,
      selectedText: window.getSelection()?.toString() || '',
    };

    const rendered = renderPromptTemplate(skill.content, {}, context);
    const label = getSkillLabel(skill);
    this.skillLabels.set(label, rendered);

    try {
      const existing = this.activeAdapter.readComposer();
      const separator =
        append && !targetRange && existing.trim() && !existing.endsWith('\n') ? '\n\n' : '';
      await this.activeAdapter.insertText(separator + label, targetRange || undefined, 'highlight');
      // Record usage asynchronously
      sendExtensionMessage('SKILL_RECORD_USAGE', { id: skill.id }).catch((error) =>
        this.stopIfExtensionContextInvalidated(error)
      );
    } catch (err) {
      if (this.stopIfExtensionContextInvalidated(err)) return;
      console.error('[SkillVault] Failed to insert skill:', err);
    } finally {
      this.activeSlashRange = null;
    }
  }

  /**
   * "Fill selection into Skill": puts the selected text into a template's `{user_input}`
   * slot. One fillable template is applied directly; several open the picker.
   */
  private async handleFillSelection(selectionText: string) {
    if (!this.activeAdapter) return;
    const adapter = this.activeAdapter;
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    const captured = this.capturedSelection;
    this.capturedSelection = null;
    const inComposer =
      !!captured?.element.isConnected && normalize(captured.text) === normalize(selectionText);
    const text = inComposer ? captured!.text : selectionText;
    // Selection elsewhere on the page: append the filled prompt to the composer instead.
    const range = inComposer ? captured!.range : null;

    let skills: Skill[];
    try {
      skills = (await sendExtensionMessage('SKILL_LIST')).filter((skill) =>
        hasUserInputSlot(skill.content)
      );
    } catch (err) {
      if (this.stopIfExtensionContextInvalidated(err)) return;
      console.warn('[SkillVault] Failed to load skills:', err);
      return;
    }
    if (this.disposed || this.activeAdapter !== adapter) return;

    if (skills.length === 1) {
      await this.applyFill(skills[0], text, range);
      return;
    }
    const composer = adapter.findComposer();
    if (!composer) return;
    this.currentComposer = composer;
    skills.sort((a, b) => Number(b.favorite) - Number(a.favorite));
    this.palette.open(
      composer.element,
      '',
      skills.map((skill) => ({ skill, score: 0 })),
      'Choose a template for your selected text'
    );
    // Set after open(): open() closes any previous palette, which clears pendingFill.
    this.pendingFill = { range, text };
  }

  private async applyFill(skill: Skill, text: string, range: TextRange | null) {
    const adapter = this.activeAdapter;
    const composer = adapter?.findComposer();
    if (!adapter || !composer) return;
    const rendered = fillUserInput(skill.content, text, {
      url: window.location.href,
      title: document.title,
      provider: adapter.name,
      selectedText: text,
    });
    try {
      if (range) {
        await adapter.insertText(rendered, range);
      } else {
        this.placeCaretAtEnd(composer);
        await adapter.insertText(rendered);
      }
      sendExtensionMessage('SKILL_RECORD_USAGE', { id: skill.id }).catch((error) =>
        this.stopIfExtensionContextInvalidated(error)
      );
    } catch (err) {
      if (this.stopIfExtensionContextInvalidated(err)) return;
      console.error('[SkillVault] Failed to fill skill:', err);
    }
  }

  private placeCaretAtEnd(composer: ComposerHandle) {
    const el = composer.element;
    el.focus();
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      el.setSelectionRange(el.value.length, el.value.length);
      return;
    }
    const sel = window.getSelection();
    if (!sel) return;
    sel.selectAllChildren(el);
    sel.collapseToEnd();
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.blurTimer);
    document.removeEventListener('input', this.onDocumentInput, true);
    document.removeEventListener('keydown', this.onDocumentKeyDown, true);
    document.removeEventListener('submit', this.onDocumentSubmit, true);
    document.removeEventListener('click', this.onDocumentClick, true);
    document.removeEventListener('focusout', this.onDocumentFocusOut, true);
    document.removeEventListener('contextmenu', this.onDocumentContextMenu, true);
    document.removeEventListener('dragover', this.onDocumentDragOver, true);
    document.removeEventListener('dragleave', this.onDocumentDragLeave, true);
    document.removeEventListener('drop', this.onDocumentDrop, true);
    document.removeEventListener('dragend', this.clearDropTarget, true);
    this.clearDropTarget();
    this.dropStyle?.remove();
    this.dropStyle = null;
    try {
      chrome.storage?.onChanged?.removeListener(this.handleSettingsChange);
      chrome.runtime?.onMessage?.removeListener(this.onRuntimeMessage);
    } catch {
      // The extension can invalidate the API while a pending message is rejecting.
    }
    if (this.disposeObserver) {
      this.disposeObserver();
      this.disposeObserver = null;
    }
    this.palette.close();
    this.skillLabels.clear();
  }
}

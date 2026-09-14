import { AdapterRegistry } from '../adapters/registry';
import { AIAdapter, ComposerHandle, TextRange } from '../adapters/types';
import { PageContext, Skill } from '../domain/types';
import { renderPromptTemplate } from '../domain/variable';
import { sendExtensionMessage } from '../infrastructure/messaging/client';
import { parseSlashCommand } from './slash/parser';
import { PaletteUI } from './palette/palette-ui';

export class ContentRuntime {
  private registry = AdapterRegistry.getInstance();
  private activeAdapter: AIAdapter | null = null;
  private currentComposer: ComposerHandle | null = null;
  private palette: PaletteUI;
  private activeSlashRange: TextRange | null = null;
  private disposeObserver: (() => void) | null = null;

  constructor() {
    this.palette = new PaletteUI({
      onSelect: (skill) => this.handleSkillSelected(skill),
      onClose: () => {
        this.activeSlashRange = null;
      },
    });
  }

  init() {
    const context: PageContext = {
      url: window.location.href,
      hostname: window.location.hostname,
      title: document.title,
    };

    this.activeAdapter = this.registry.getBestAdapter(context);
    if (!this.activeAdapter || this.activeAdapter.match(context) === 0) {
      // Not a supported AI site, do not attach
      return;
    }

    // Attach composer lifecycle observer
    this.disposeObserver = this.activeAdapter.observeComposer((composer) => {
      this.attachToComposer(composer);
    });

    // Initial check
    const initialComposer = this.activeAdapter.findComposer();
    if (initialComposer) {
      this.attachToComposer(initialComposer);
    }
  }

  private attachToComposer(composer: ComposerHandle | null) {
    if (!composer || composer.element === this.currentComposer?.element) {
      return;
    }

    this.currentComposer = composer;
    const el = composer.element;

    el.addEventListener('input', () => this.handleInput());
    el.addEventListener('keydown', (e) => this.handleKeyDown(e), true);
    el.addEventListener('blur', () => {
      // Delay closing to allow click events inside palette to register
      setTimeout(() => {
        if (!this.palette.isPaletteOpen()) return;
        this.palette.close();
      }, 250);
    });
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.palette.isPaletteOpen()) {
      const handled = this.palette.handleKeyDown(e);
      if (handled) {
        e.stopPropagation();
      }
    }
  }

  private async handleInput() {
    if (!this.activeAdapter) return;

    const caretContext = this.activeAdapter.getCaretContext?.();
    const textBefore = caretContext ? caretContext.textBefore : this.activeAdapter.readComposer();

    const slashResult = parseSlashCommand(textBefore);

    if (slashResult.type === 'skill_palette') {
      this.activeSlashRange = slashResult.range;

      try {
        const results = await sendExtensionMessage('SKILL_SEARCH', { query: slashResult.query });
        if (this.currentComposer) {
          if (!this.palette.isPaletteOpen()) {
            this.palette.open(this.currentComposer.element, slashResult.query, results);
          } else {
            this.palette.update(slashResult.query, results);
          }
        }
      } catch (err) {
        console.warn('[SkillVault] Failed to query skills:', err);
      }
    } else {
      if (this.palette.isPaletteOpen()) {
        this.palette.close();
      }
      this.activeSlashRange = null;
    }
  }

  private async handleSkillSelected(skill: Skill) {
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

    try {
      await this.activeAdapter.insertText(rendered, targetRange || undefined);
      // Record usage asynchronously
      sendExtensionMessage('SKILL_RECORD_USAGE', { id: skill.id }).catch(() => {});
    } catch (err) {
      console.error('[SkillVault] Failed to insert skill:', err);
    } finally {
      this.activeSlashRange = null;
    }
  }

  dispose() {
    if (this.disposeObserver) {
      this.disposeObserver();
      this.disposeObserver = null;
    }
    this.palette.close();
  }
}

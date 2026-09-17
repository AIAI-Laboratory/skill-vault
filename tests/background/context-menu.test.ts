import { describe, it, expect, vi, beforeEach } from 'vitest';
import { skillMarkdown } from '../fixtures/skill-markdown';
import { readPageSelection } from '../../src/content/selection';
import {
  CONTEXT_MENU_ID,
  initContextMenu,
  handleContextMenuClick,
  setupContextMenuListener,
} from '../../src/background/context-menu';

describe('context-menu', () => {
  let mockContextMenus: any;
  let mockSidePanel: any;
  let mockStorageLocal: any;

  beforeEach(() => {
    mockContextMenus = {
      removeAll: vi.fn((cb) => cb && cb()),
      create: vi.fn(),
      onClicked: {
        addListener: vi.fn(),
      },
    };

    mockSidePanel = {
      open: vi.fn().mockResolvedValue(undefined),
    };

    mockStorageLocal = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    (globalThis as any).chrome = {
      contextMenus: mockContextMenus,
      sidePanel: mockSidePanel,
      storage: {
        local: mockStorageLocal,
      },
    };
  });

  it('initContextMenu removes previous items and registers selection context menu', () => {
    initContextMenu();

    expect(mockContextMenus.removeAll).toHaveBeenCalled();
    expect(mockContextMenus.create).toHaveBeenCalledWith({
      id: CONTEXT_MENU_ID,
      title: 'Save selection as Skill',
      contexts: ['selection'],
    });
  });

  it('setupContextMenuListener adds handleContextMenuClick listener', () => {
    setupContextMenuListener();
    expect(mockContextMenus.onClicked.addListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it('handleContextMenuClick synchronously opens side panel with windowId and saves draft', () => {
    const info: any = {
      menuItemId: CONTEXT_MENU_ID,
      selectionText: '  const a = 123;  ',
      pageUrl: 'https://example.com/test',
    };
    const tab: any = {
      id: 99,
      windowId: 10,
      title: 'Example Page',
      url: 'https://example.com/test',
    };

    handleContextMenuClick(info, tab);

    // 1. sidePanel.open called synchronously with windowId
    expect(mockSidePanel.open).toHaveBeenCalledWith({ windowId: 10 });

    // 2. storage.local.set called with draft data
    expect(mockStorageLocal.set).toHaveBeenCalledWith({
      'draft:skill': expect.objectContaining({
        rawContent: '  const a = 123;  ',
        detectedFormat: 'code',
        formatLabel: 'TypeScript Code',
        suggestedName: 'const a = 123;',
        suggestedShortcut: 'const-a-123',
        suggestedTags: ['snippet'],
        url: 'https://example.com/test',
        title: 'Example Page',
        timestamp: expect.any(Number),
        content: '  const a = 123;  ',
        activeTemplateId: 'original_selection',
      }),
    });
  });

  it('handleContextMenuClick opens sidePanel with tabId when windowId is missing', () => {
    const info: any = {
      menuItemId: CONTEXT_MENU_ID,
      selectionText: 'hello world',
    };
    const tab: any = {
      id: 42,
    };

    handleContextMenuClick(info, tab);

    expect(mockSidePanel.open).toHaveBeenCalledWith({ tabId: 42 });
    expect(mockStorageLocal.set).toHaveBeenCalledWith({
      'draft:skill': expect.objectContaining({
        rawContent: 'hello world',
        detectedFormat: 'text',
        formatLabel: 'Text / Article Content',
        suggestedName: 'hello world',
        suggestedShortcut: 'hello-world',
        url: '',
        title: '',
        timestamp: expect.any(Number),
        content: 'hello world',
      }),
    });
  });

  it.each([skillMarkdown, skillMarkdown.replace(/\n/g, ' ')])(
    'imports skill metadata and exact content with or without selection line breaks',
    (selection) => {
      handleContextMenuClick({
        menuItemId: CONTEXT_MENU_ID,
        selectionText: selection,
        pageUrl:
          'https://github.com/example/skills/blob/main/codebase-replication/SKILL.md?plain=1',
      } as chrome.contextMenus.OnClickData);

      const draft = mockStorageLocal.set.mock.calls[0][0]['draft:skill'];
      expect(draft).toMatchObject({
        rawContent: selection,
        content: selection,
        detectedFormat: 'prompt',
        formatLabel: 'Skill Markdown',
        suggestedName: 'codebase-replication',
        suggestedShortcut: 'codebase-replication',
        suggestedDescription:
          'Learn conventions from a source repository and apply them to a target repository.',
        activeTemplateId: 'original_selection',
      });
    }
  );

  it.each([
    'SELECT * FROM users WHERE active = 1;',
    '  Some text with &lt;literal entities&gt;\r\n\r\n\r\n  and indentation.  ',
    '```python\ndef example():\n    return 1\n```',
    'You are an architect. Review this design.',
    '# Partial skill selection\n\nLearn from source; record where patterns came from; join the findings.',
  ])('preserves the selection by default and keeps templates opt-in: %s', (selection) => {
    handleContextMenuClick({
      menuItemId: CONTEXT_MENU_ID,
      selectionText: selection,
    } as chrome.contextMenus.OnClickData);

    const draft = mockStorageLocal.set.mock.calls[0][0]['draft:skill'];
    expect(draft.content).toBe(selection);
    expect(draft.templateOptions[0]).toMatchObject({
      id: draft.activeTemplateId,
      content: selection,
      isPrimary: true,
    });
    expect(draft.templateOptions.length).toBeGreaterThan(1);
    expect(
      draft.templateOptions
        .slice(1)
        .every((template: { isPrimary: boolean }) => !template.isPrimary)
    ).toBe(true);
  });

  it('handleContextMenuClick ignores clicks when menuItemId is not matching or no selection', () => {
    const infoWrongId: any = {
      menuItemId: 'other-menu-id',
      selectionText: 'some text',
    };
    handleContextMenuClick(infoWrongId);
    expect(mockSidePanel.open).not.toHaveBeenCalled();
    expect(mockStorageLocal.set).not.toHaveBeenCalled();

    const infoNoText: any = {
      menuItemId: CONTEXT_MENU_ID,
      selectionText: '',
    };
    handleContextMenuClick(infoNoText);
    expect(mockSidePanel.open).not.toHaveBeenCalled();
    expect(mockStorageLocal.set).not.toHaveBeenCalled();
  });

  it('reads formatted text from the clicked frame and opens the panel without waiting', async () => {
    const selection = `${skillMarkdown}\n    indented line\n\twith a tab\n\n`;
    const executeScript = vi.fn().mockResolvedValue([{ frameId: 7, result: selection }]);
    chrome.scripting = { executeScript } as unknown as typeof chrome.scripting;

    const saving = handleContextMenuClick(
      {
        menuItemId: CONTEXT_MENU_ID,
        selectionText: selection.replace(/\s+/g, ' ').trim(),
        frameId: 7,
      } as chrome.contextMenus.OnClickData,
      { id: 99, windowId: 10 } as chrome.tabs.Tab
    );

    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 99, frameIds: [7] },
      func: readPageSelection,
      injectImmediately: true,
    });
    expect(mockSidePanel.open).toHaveBeenCalledWith({ windowId: 10 });
    expect(mockStorageLocal.set).not.toHaveBeenCalled();

    await saving;
    expect(mockStorageLocal.set).toHaveBeenCalledTimes(1);
    const draft = mockStorageLocal.set.mock.calls[0][0]['draft:skill'];
    expect(draft.rawContent).toBe(selection);
    expect(draft.content).toBe(selection);
    expect(draft.templateOptions[0].content).toBe(selection);
    expect(draft.suggestedName).toBe('codebase-replication');
    expect(draft.formatLabel).toBe('Skill Markdown');
  });

  it.each(['', undefined, 'A different selection'])(
    'falls back if the page selection is missing or changed: %s',
    async (result) => {
      const executeScript = vi.fn().mockResolvedValue([{ frameId: 0, result }]);
      chrome.scripting = { executeScript } as unknown as typeof chrome.scripting;
      await handleContextMenuClick(
        {
          menuItemId: CONTEXT_MENU_ID,
          selectionText: 'Original text',
        } as chrome.contextMenus.OnClickData,
        { id: 99 } as chrome.tabs.Tab
      );
      expect(executeScript.mock.calls[0][0].target.frameIds).toEqual([0]);
      expect(mockStorageLocal.set.mock.calls[0][0]['draft:skill'].content).toBe('Original text');
    }
  );

  it('keeps the browser selection when the page does not allow script injection', async () => {
    chrome.scripting = {
      executeScript: vi.fn().mockRejectedValue(new Error('Cannot access this page')),
    } as unknown as typeof chrome.scripting;
    await handleContextMenuClick(
      {
        menuItemId: CONTEXT_MENU_ID,
        selectionText: 'Original text',
      } as chrome.contextMenus.OnClickData,
      { id: 99 } as chrome.tabs.Tab
    );
    expect(mockStorageLocal.set.mock.calls[0][0]['draft:skill'].content).toBe('Original text');
  });

  it('does not replace a newer draft with a slow earlier selection read', async () => {
    let resolveEarlier!: (value: { frameId: number; result: string }[]) => void;
    const executeScript = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveEarlier = resolve;
          })
      )
      .mockResolvedValueOnce([{ frameId: 0, result: 'Newer\nselection' }]);
    chrome.scripting = { executeScript } as unknown as typeof chrome.scripting;
    const tab = { id: 99 } as chrome.tabs.Tab;
    const earlier = handleContextMenuClick(
      {
        menuItemId: CONTEXT_MENU_ID,
        selectionText: 'Earlier selection',
      } as chrome.contextMenus.OnClickData,
      tab
    );
    await handleContextMenuClick(
      {
        menuItemId: CONTEXT_MENU_ID,
        selectionText: 'Newer selection',
      } as chrome.contextMenus.OnClickData,
      tab
    );
    resolveEarlier([{ frameId: 0, result: 'Earlier\nselection' }]);
    await earlier;
    expect(mockStorageLocal.set).toHaveBeenCalledTimes(1);
    expect(mockStorageLocal.set.mock.calls[0][0]['draft:skill'].content).toBe('Newer\nselection');
  });
});

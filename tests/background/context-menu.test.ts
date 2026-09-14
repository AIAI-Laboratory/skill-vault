import { describe, it, expect, vi, beforeEach } from 'vitest';
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
      'draft:skill': {
        content: 'const a = 123;',
        url: 'https://example.com/test',
        title: 'Example Page',
        timestamp: expect.any(Number),
      },
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
      'draft:skill': {
        content: 'hello world',
        url: '',
        title: '',
        timestamp: expect.any(Number),
      },
    });
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
});

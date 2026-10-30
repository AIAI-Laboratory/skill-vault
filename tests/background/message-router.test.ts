import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMessageRouter } from '../../src/background/message-router';
import { ExtensionMessage, ExtensionResponse } from '../../src/infrastructure/messaging/protocol';

/** Factory producing hoisted updater mock functions. */
function createHoistedUpdaterMocks() {
  return {
    mockCheckForUpdates: vi.fn(),
    mockGetStoredUpdateStatus: vi.fn(),
    mockApplyUpdate: vi.fn(),
  };
}

const { mockCheckForUpdates, mockGetStoredUpdateStatus, mockApplyUpdate } =
  vi.hoisted(createHoistedUpdaterMocks);

/** Mock module factory providing stubbed updater implementations. */
function createUpdaterModuleMock() {
  return {
    checkForUpdates: mockCheckForUpdates,
    getStoredUpdateStatus: mockGetStoredUpdateStatus,
    applyUpdate: mockApplyUpdate,
  };
}

vi.mock('../../src/background/updater', createUpdaterModuleMock);

describe('Message Router Update Actions', () => {
  let messageListener: (
    msg: ExtensionMessage,
    sender: unknown,
    sendResponse: (res: ExtensionResponse) => void
  ) => boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockOnMessage = {
      addListener: vi.fn((listener) => {
        messageListener = listener;
      }),
    };

    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: mockOnMessage,
      },
    });

    setupMessageRouter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Tests dispatching CHECK_FOR_UPDATES calls updater service. */
  it('handles CHECK_FOR_UPDATES message', async () => {
    const expectedUpdateInfo = {
      currentVersion: '0.1.4',
      latestVersion: '0.2.0',
      hasUpdate: true,
      status: 'available' as const,
      lastCheckedAt: Date.now(),
    };
    mockCheckForUpdates.mockResolvedValue(expectedUpdateInfo);

    const msg: ExtensionMessage<'CHECK_FOR_UPDATES'> = {
      id: 'msg-1',
      version: 1,
      type: 'CHECK_FOR_UPDATES',
      payload: undefined,
    };

    const sendResponse = vi.fn();
    const isAsync = messageListener(msg, {}, sendResponse);
    expect(isAsync).toBe(true);

    // Await microtasks for enqueueTask resolution
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        id: 'msg-1',
        ok: true,
        data: expectedUpdateInfo,
      });
    });
    expect(mockCheckForUpdates).toHaveBeenCalled();
  });

  /** Tests dispatching GET_UPDATE_STATUS calls updater service. */
  it('handles GET_UPDATE_STATUS message', async () => {
    const expectedStatus = {
      currentVersion: '0.1.4',
      hasUpdate: false,
      status: 'idle' as const,
      lastCheckedAt: 0,
    };
    mockGetStoredUpdateStatus.mockResolvedValue(expectedStatus);

    const msg: ExtensionMessage<'GET_UPDATE_STATUS'> = {
      id: 'msg-2',
      version: 1,
      type: 'GET_UPDATE_STATUS',
      payload: undefined,
    };

    const sendResponse = vi.fn();
    messageListener(msg, {}, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        id: 'msg-2',
        ok: true,
        data: expectedStatus,
      });
    });
    expect(mockGetStoredUpdateStatus).toHaveBeenCalled();
  });

  /** Tests dispatching APPLY_UPDATE calls applyUpdate on updater. */
  it('handles APPLY_UPDATE message', async () => {
    const expectedResult = {
      success: true,
      reloadTriggered: true,
      message: 'Reloading extension...',
    };
    mockApplyUpdate.mockResolvedValue(expectedResult);

    const msg: ExtensionMessage<'APPLY_UPDATE'> = {
      id: 'msg-3',
      version: 1,
      type: 'APPLY_UPDATE',
      payload: undefined,
    };

    const sendResponse = vi.fn();
    messageListener(msg, {}, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        id: 'msg-3',
        ok: true,
        data: expectedResult,
      });
    });
    expect(mockApplyUpdate).toHaveBeenCalled();
  });
});

import {
  MessageType,
  MessagePayloadMap,
  MessageResponseMap,
  ExtensionMessage,
  ExtensionResponse,
} from './protocol';

/**
 * Sends a type-safe message to the extension background service worker.
 */
export async function sendExtensionMessage<K extends MessageType>(
  type: K,
  payload?: MessagePayloadMap[K]
): Promise<MessageResponseMap[K]> {
  const message: ExtensionMessage<MessagePayloadMap[K]> = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    version: 1,
    type,
    payload: payload as MessagePayloadMap[K],
  };

  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
    throw new Error('chrome.runtime.sendMessage is not available');
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: ExtensionResponse<MessageResponseMap[K]>) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!response) {
        return reject(new Error('No response received from background service worker'));
      }
      if (!response.ok) {
        return reject(new Error(response.error || 'Unknown error occurred in service worker'));
      }
      resolve(response.data as MessageResponseMap[K]);
    });
  });
}

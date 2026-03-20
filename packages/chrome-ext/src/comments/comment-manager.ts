/**
 * Comment Manager — Chrome extension shim
 *
 * Re-exports the core CommentManager from @mdview/core, pre-configured
 * with Chrome extension adapters that delegate to chrome.runtime.sendMessage
 * for file writes (WRITE_FILE) and username lookup (GET_USERNAME).
 *
 * This shim will be removed once the extension is fully migrated to core.
 */

import {
  CommentManager as CoreCommentManager,
  type CommentManagerAdapters,
  type FileAdapter,
  type IdentityAdapter,
  type FileWriteResult,
  type FileChangeInfo,
} from '@mdview/core';

/**
 * Type-safe helper to send a Chrome runtime message and parse the response.
 */
async function sendChromeMessage<T>(message: Record<string, unknown>): Promise<T | undefined> {
  const result: unknown = await chrome.runtime.sendMessage(message);
  return result as T | undefined;
}

/**
 * Chrome extension FileAdapter — delegates to the service worker
 * via chrome.runtime.sendMessage({ type: 'WRITE_FILE', ... }).
 */
class ChromeFileAdapter implements FileAdapter {
  async writeFile(path: string, content: string): Promise<FileWriteResult> {
    const response = await sendChromeMessage<{ success?: boolean; error?: string }>({
      type: 'WRITE_FILE',
      payload: { path, content },
    });

    if (response?.error) {
      return { success: false, error: response.error };
    }
    return { success: true };
  }

  readFile(_path: string): Promise<string> {
    return Promise.reject(new Error('readFile not supported via Chrome messaging'));
  }

  checkChanged(_url: string, _lastHash: string): Promise<FileChangeInfo> {
    return Promise.resolve({ changed: false });
  }

  watch(_path: string, _callback: () => void): () => void {
    return () => {};
  }
}

/**
 * Chrome extension IdentityAdapter — delegates to the native host
 * via chrome.runtime.sendMessage({ type: 'GET_USERNAME' }).
 */
class ChromeIdentityAdapter implements IdentityAdapter {
  async getUsername(): Promise<string> {
    try {
      const resp = await sendChromeMessage<{ username?: string }>({
        type: 'GET_USERNAME',
      });
      return resp?.username ?? '';
    } catch {
      // Native host may not be installed
      return '';
    }
  }
}

/**
 * CommentManager pre-configured with Chrome extension adapters.
 * Drop-in replacement for the previous monolithic CommentManager.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class CommentManager extends CoreCommentManager {
  constructor(adapters?: CommentManagerAdapters) {
    // If no adapters provided, use Chrome-backed defaults
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const resolved: CommentManagerAdapters = adapters ?? {
      file: new ChromeFileAdapter(),
      identity: new ChromeIdentityAdapter(),
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super(resolved);
  }
}

import type { MessagingAdapter, IPCMessage } from '@mdview/core';

export class ElectronMessagingAdapter implements MessagingAdapter {
  async send(message: IPCMessage): Promise<unknown> {
    const { type, payload } = message;

    switch (type) {
      case 'GET_STATE':
        return window.mdview.getState();

      case 'UPDATE_PREFERENCES':
        return window.mdview.updatePreferences(payload as Record<string, unknown>);

      case 'CACHE_GENERATE_KEY': {
        const p = payload as {
          filePath: string;
          contentHash: string;
          theme: string;
          preferences: Record<string, unknown>;
        };
        return window.mdview.cacheGenerateKey(p.filePath, p.contentHash, p.theme, p.preferences);
      }

      case 'CACHE_GET': {
        const key = (payload as { key: string }).key;
        return window.mdview.cacheGet(key);
      }

      case 'CACHE_SET': {
        const { key, result } = payload as { key: string; result: unknown };
        return window.mdview.cacheSet(key, result as never);
      }

      case 'CHECK_FILE_CHANGED': {
        const { url, lastHash } = payload as { url: string; lastHash: string };
        return window.mdview.checkFileChanged(url, lastHash);
      }

      case 'GET_USERNAME':
        return window.mdview.getUsername();

      case 'WRITE_FILE': {
        const { path, content } = payload as { path: string; content: string };
        return window.mdview.writeFile(path, content);
      }

      default:
        console.warn(`[mdview] Unknown message type: ${type}`);
        return undefined;
    }
  }
}

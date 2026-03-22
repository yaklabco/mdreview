import type { MessagingAdapter, IPCMessage } from '@mdreview/core';

export class ElectronMessagingAdapter implements MessagingAdapter {
  async send(message: IPCMessage): Promise<unknown> {
    const { type, payload } = message;

    switch (type) {
      case 'GET_STATE':
        return window.mdreview.getState();

      case 'UPDATE_PREFERENCES':
        return window.mdreview.updatePreferences(payload as Record<string, unknown>);

      case 'CACHE_GENERATE_KEY': {
        const p = payload as {
          filePath: string;
          contentHash: string;
          content: string;
          theme: string;
          preferences: Record<string, unknown>;
        };
        const key = await window.mdreview.cacheGenerateKey(
          p.filePath,
          p.contentHash || p.content,
          p.theme,
          p.preferences
        );
        return { key };
      }

      case 'CACHE_GET': {
        const key = (payload as { key: string }).key;
        const result = await window.mdreview.cacheGet(key);
        return { result };
      }

      case 'CACHE_SET': {
        const { key, result } = payload as { key: string; result: unknown };
        return window.mdreview.cacheSet(key, result as never);
      }

      case 'CHECK_FILE_CHANGED': {
        const { url, lastHash } = payload as { url: string; lastHash: string };
        return window.mdreview.checkFileChanged(url, lastHash);
      }

      case 'GET_USERNAME':
        return window.mdreview.getUsername();

      case 'WRITE_FILE': {
        const { path, content } = payload as { path: string; content: string };
        return window.mdreview.writeFile(path, content);
      }

      default:
        console.warn(`[mdreview] Unknown message type: ${type}`);
        return undefined;
    }
  }
}

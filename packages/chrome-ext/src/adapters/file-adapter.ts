import type { FileAdapter, FileWriteResult, FileChangeInfo } from '@mdreview/core';
import { sendChromeMessage } from './chrome-message';

export class ChromeFileAdapter implements FileAdapter {
  async writeFile(path: string, content: string): Promise<FileWriteResult> {
    let response: { success?: boolean; error?: string } | undefined;
    try {
      response = await sendChromeMessage<{ success?: boolean; error?: string }>({
        type: 'WRITE_FILE',
        payload: { path, content },
      });
    } catch (err) {
      return { success: false, error: `sendChromeMessage error: ${String(err)}` };
    }

    if (response?.error) {
      return { success: false, error: response.error };
    }
    if (response === undefined) {
      return { success: false, error: 'No response from service worker' };
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

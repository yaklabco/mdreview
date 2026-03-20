import type { FileAdapter, FileWriteResult, FileChangeInfo } from '@mdview/core';
import { sendChromeMessage } from './chrome-message';

export class ChromeFileAdapter implements FileAdapter {
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

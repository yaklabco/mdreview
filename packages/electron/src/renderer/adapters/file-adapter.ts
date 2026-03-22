import type { FileAdapter, FileWriteResult, FileChangeInfo } from '@mdreview/core';

export class ElectronRendererFileAdapter implements FileAdapter {
  async readFile(path: string): Promise<string> {
    return window.mdreview.readFile(path);
  }

  async writeFile(path: string, content: string): Promise<FileWriteResult> {
    return window.mdreview.writeFile(path, content);
  }

  async checkChanged(url: string, lastHash: string): Promise<FileChangeInfo> {
    return window.mdreview.checkFileChanged(url, lastHash);
  }

  watch(path: string, callback: () => void): () => void {
    void window.mdreview.watchFile(path);
    const unsubscribe = window.mdreview.onFileChanged((changedPath) => {
      if (changedPath === path) {
        callback();
      }
    });

    return () => {
      unsubscribe();
      void window.mdreview.unwatchFile(path);
    };
  }
}

import type { FileAdapter, FileWriteResult, FileChangeInfo } from '@mdview/core';

export class ElectronRendererFileAdapter implements FileAdapter {
  async readFile(path: string): Promise<string> {
    return window.mdview.readFile(path);
  }

  async writeFile(path: string, content: string): Promise<FileWriteResult> {
    return window.mdview.writeFile(path, content);
  }

  async checkChanged(url: string, lastHash: string): Promise<FileChangeInfo> {
    return window.mdview.checkFileChanged(url, lastHash);
  }

  watch(path: string, callback: () => void): () => void {
    void window.mdview.watchFile(path);
    const unsubscribe = window.mdview.onFileChanged((changedPath) => {
      if (changedPath === path) {
        callback();
      }
    });

    return () => {
      unsubscribe();
      void window.mdview.unwatchFile(path);
    };
  }
}

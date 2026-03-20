import type { FileAdapter, FileWriteResult, FileChangeInfo } from '@mdview/core/node';
import { readFile, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import { watch, type FSWatcher } from 'chokidar';

export class ElectronFileAdapter implements FileAdapter {
  private watchers = new Map<string, FSWatcher>();

  async readFile(path: string): Promise<string> {
    return readFile(path, 'utf-8');
  }

  async writeFile(path: string, content: string): Promise<FileWriteResult> {
    try {
      await writeFile(path, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async checkChanged(url: string, lastHash: string): Promise<FileChangeInfo> {
    try {
      const content = await readFile(url, 'utf-8');
      const newHash = createHash('sha256').update(content).digest('hex');
      return {
        changed: newHash !== lastHash,
        newHash,
      };
    } catch (err) {
      return { changed: false, error: (err as Error).message };
    }
  }

  watch(path: string, callback: () => void): () => void {
    const watcher = watch(path, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100 },
    });
    watcher.on('change', callback);
    this.watchers.set(path, watcher);

    return () => {
      void watcher.close();
      this.watchers.delete(path);
    };
  }

  dispose(): void {
    for (const watcher of this.watchers.values()) {
      void watcher.close();
    }
    this.watchers.clear();
  }
}

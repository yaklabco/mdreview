import { readdir } from 'fs/promises';
import { join, extname } from 'path';
import { watch } from 'chokidar';
import type { DirectoryEntry } from '../shared/workspace-types';

const MD_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx']);
const EXCLUDED_DIRS = new Set(['node_modules']);

export interface ListDirectoryOptions {
  showAllFiles?: boolean;
}

interface WatcherHandle {
  close(): Promise<void>;
}

export class DirectoryService {
  private watchers = new Map<string, WatcherHandle>();

  async listDirectory(dirPath: string, options?: ListDirectoryOptions): Promise<DirectoryEntry[]> {
    try {
      return await this.readDirectoryShallow(dirPath, options?.showAllFiles ?? false);
    } catch {
      return [];
    }
  }

  watchDirectory(dirPath: string, callback: () => void): void {
    this.unwatchDirectory(dirPath);

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(callback, 300);
    };

    const watcher = watch(dirPath, {
      ignoreInitial: true,
      persistent: true,
    });

    watcher.on('add', debounced);
    watcher.on('unlink', debounced);
    watcher.on('addDir', debounced);
    watcher.on('unlinkDir', debounced);

    this.watchers.set(dirPath, watcher);
  }

  unwatchDirectory(dirPath: string): void {
    const watcher = this.watchers.get(dirPath);
    if (watcher) {
      void watcher.close();
      this.watchers.delete(dirPath);
    }
  }

  dispose(): void {
    for (const watcher of this.watchers.values()) {
      void watcher.close();
    }
    this.watchers.clear();
  }

  private async readDirectoryShallow(
    dirPath: string,
    showAllFiles: boolean
  ): Promise<DirectoryEntry[]> {
    const dirents = await readdir(dirPath, { withFileTypes: true });
    const directories: DirectoryEntry[] = [];
    const files: DirectoryEntry[] = [];

    for (const dirent of dirents) {
      // Skip hidden files/directories
      if (dirent.name.startsWith('.')) continue;

      const fullPath = join(dirPath, dirent.name);

      if (dirent.isDirectory()) {
        if (EXCLUDED_DIRS.has(dirent.name)) continue;

        directories.push({
          name: dirent.name,
          path: fullPath,
          type: 'directory',
        });
      } else if (dirent.isFile()) {
        if (showAllFiles || MD_EXTENSIONS.has(extname(dirent.name).toLowerCase())) {
          files.push({
            name: dirent.name,
            path: fullPath,
            type: 'file',
          });
        }
      }
    }

    // Sort directories alphabetically, then files alphabetically
    directories.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    return [...directories, ...files];
  }
}

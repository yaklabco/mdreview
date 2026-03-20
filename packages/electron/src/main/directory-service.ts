import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { watch } from 'chokidar';
import type { DirectoryEntry } from '../shared/workspace-types';

const MD_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx']);

interface WatcherHandle {
  close(): Promise<void>;
}

export class DirectoryService {
  private watchers = new Map<string, WatcherHandle>();

  listDirectory(dirPath: string): DirectoryEntry[] {
    try {
      return this.readDirectoryRecursive(dirPath);
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

  private readDirectoryRecursive(dirPath: string): DirectoryEntry[] {
    const rawEntries = readdirSync(dirPath);
    const directories: DirectoryEntry[] = [];
    const files: DirectoryEntry[] = [];

    for (const name of rawEntries) {
      // Skip hidden files/directories
      if (name.startsWith('.')) continue;

      const fullPath = join(dirPath, name);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        const children = this.readDirectoryRecursive(fullPath);
        // Only include directories that contain markdown files (directly or nested)
        if (children.length > 0) {
          directories.push({
            name,
            path: fullPath,
            type: 'directory',
            children,
          });
        }
      } else if (stat.isFile() && MD_EXTENSIONS.has(extname(name).toLowerCase())) {
        files.push({
          name,
          path: fullPath,
          type: 'file',
        });
      }
    }

    // Sort directories alphabetically, then files alphabetically
    directories.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    return [...directories, ...files];
  }
}

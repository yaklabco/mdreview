import type ElectronStore from 'electron-store';
import { existsSync } from 'fs';

const MAX_RECENT = 10;
const STORE_KEY = 'recentFiles';

export class RecentFilesManager {
  private files: string[];

  constructor(
    private store: ElectronStore,
    private fileExists: (path: string) => boolean = existsSync
  ) {
    this.files = (this.store.get(STORE_KEY, []) as string[]).slice(0, MAX_RECENT);
  }

  addFile(path: string): void {
    this.files = this.files.filter((f) => f !== path);
    this.files.unshift(path);
    if (this.files.length > MAX_RECENT) {
      this.files = this.files.slice(0, MAX_RECENT);
    }
    this.persist();
  }

  getFiles(): string[] {
    return this.files.filter((f) => this.fileExists(f));
  }

  clear(): void {
    this.files = [];
    this.persist();
  }

  private persist(): void {
    this.store.set(STORE_KEY, this.files);
  }
}

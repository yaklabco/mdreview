import type { DirectoryEntry } from '../shared/workspace-types';

export class DirectoryService {
  listDirectory(_dirPath: string): DirectoryEntry[] {
    return [];
  }

  watchDirectory(_dirPath: string, _callback: () => void): void {
    // Will be implemented in task 5.6
  }

  unwatchDirectory(_dirPath: string): void {
    // Will be implemented in task 5.6
  }

  dispose(): void {
    // Will be implemented in task 5.6
  }
}

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecentFilesManager } from './recent-files';

function createMockStore() {
  const data = new Map<string, unknown>();
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => data.get(key) ?? defaultValue),
    set: vi.fn((key: string, value: unknown) => data.set(key, value)),
    delete: vi.fn((key: string) => data.delete(key)),
    _data: data,
  };
}

describe('RecentFilesManager', () => {
  let store: ReturnType<typeof createMockStore>;
  let manager: RecentFilesManager;
  let fileExists: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = createMockStore();
    fileExists = vi.fn().mockReturnValue(true);
    manager = new RecentFilesManager(store as never, fileExists);
  });

  it('should return empty list initially', () => {
    expect(manager.getFiles()).toEqual([]);
  });

  it('should add a file and persist it', () => {
    manager.addFile('/tmp/test.md');
    expect(manager.getFiles()).toEqual(['/tmp/test.md']);
    expect(store.set).toHaveBeenCalledWith('recentFiles', ['/tmp/test.md']);
  });

  it('should deduplicate files (most recent first)', () => {
    manager.addFile('/tmp/a.md');
    manager.addFile('/tmp/b.md');
    manager.addFile('/tmp/a.md');
    expect(manager.getFiles()).toEqual(['/tmp/a.md', '/tmp/b.md']);
  });

  it('should cap at 10 files', () => {
    for (let i = 0; i < 12; i++) {
      manager.addFile(`/tmp/file-${i}.md`);
    }
    const files = manager.getFiles();
    expect(files).toHaveLength(10);
    expect(files[0]).toBe('/tmp/file-11.md');
  });

  it('should filter out nonexistent files on get', () => {
    manager.addFile('/tmp/exists.md');
    manager.addFile('/tmp/gone.md');
    fileExists.mockImplementation((p: string) => p !== '/tmp/gone.md');
    expect(manager.getFiles()).toEqual(['/tmp/exists.md']);
  });

  it('should clear all files', () => {
    manager.addFile('/tmp/a.md');
    manager.addFile('/tmp/b.md');
    manager.clear();
    expect(manager.getFiles()).toEqual([]);
    expect(store.set).toHaveBeenCalledWith('recentFiles', []);
  });

  it('should restore files from store on construction', () => {
    store._data.set('recentFiles', ['/tmp/restored.md']);
    const manager2 = new RecentFilesManager(store as never, fileExists);
    expect(manager2.getFiles()).toEqual(['/tmp/restored.md']);
  });
});

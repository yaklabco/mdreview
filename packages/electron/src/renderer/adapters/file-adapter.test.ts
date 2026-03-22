import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElectronRendererFileAdapter } from './file-adapter';

function createMockMdview() {
  return {
    getState: vi.fn(),
    updatePreferences: vi.fn(),
    cacheGenerateKey: vi.fn(),
    cacheGet: vi.fn(),
    cacheSet: vi.fn(),
    readFile: vi.fn().mockResolvedValue('# Test content'),
    writeFile: vi.fn().mockResolvedValue({ success: true }),
    checkFileChanged: vi.fn().mockResolvedValue({ changed: true, newHash: 'abc' }),
    watchFile: vi.fn().mockResolvedValue(undefined),
    unwatchFile: vi.fn().mockResolvedValue(undefined),
    getUsername: vi.fn(),
    saveFile: vi.fn(),
    printToPDF: vi.fn(),
    getOpenFilePath: vi.fn(),
    onFileChanged: vi.fn().mockReturnValue(vi.fn()),
    onPreferencesUpdated: vi.fn().mockReturnValue(vi.fn()),
    onThemeChanged: vi.fn().mockReturnValue(vi.fn()),
  };
}

describe('ElectronRendererFileAdapter', () => {
  let adapter: ElectronRendererFileAdapter;
  let mockMdview: ReturnType<typeof createMockMdview>;

  beforeEach(() => {
    mockMdview = createMockMdview();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    (globalThis as Record<string, unknown>).window = { mdreview: mockMdview } as never;
    adapter = new ElectronRendererFileAdapter();
  });

  it('should delegate readFile to window.mdreview', async () => {
    const result = await adapter.readFile('/tmp/test.md');
    expect(mockMdview.readFile).toHaveBeenCalledWith('/tmp/test.md');
    expect(result).toBe('# Test content');
  });

  it('should delegate writeFile to window.mdreview', async () => {
    const result = await adapter.writeFile('/tmp/out.md', 'content');
    expect(mockMdview.writeFile).toHaveBeenCalledWith('/tmp/out.md', 'content');
    expect(result).toEqual({ success: true });
  });

  it('should delegate checkChanged to window.mdreview', async () => {
    const result = await adapter.checkChanged('/tmp/test.md', 'old-hash');
    expect(mockMdview.checkFileChanged).toHaveBeenCalledWith('/tmp/test.md', 'old-hash');
    expect(result).toEqual({ changed: true, newHash: 'abc' });
  });

  it('should set up watcher via IPC', () => {
    const callback = vi.fn();
    const unwatch = adapter.watch('/tmp/test.md', callback);

    expect(mockMdview.watchFile).toHaveBeenCalledWith('/tmp/test.md');
    expect(mockMdview.onFileChanged).toHaveBeenCalled();

    expect(typeof unwatch).toBe('function');
  });

  it('should clean up watcher on unsubscribe', () => {
    const unsubscribe = vi.fn();
    mockMdview.onFileChanged.mockReturnValue(unsubscribe);

    const callback = vi.fn();
    const unwatch = adapter.watch('/tmp/test.md', callback);
    unwatch();

    expect(unsubscribe).toHaveBeenCalled();
    expect(mockMdview.unwatchFile).toHaveBeenCalledWith('/tmp/test.md');
  });
});

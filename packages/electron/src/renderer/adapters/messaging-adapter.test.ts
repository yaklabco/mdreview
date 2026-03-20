import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElectronMessagingAdapter } from './messaging-adapter';

function createMockMdview() {
  return {
    getState: vi.fn().mockResolvedValue({ preferences: { theme: 'github-light' } }),
    updatePreferences: vi.fn().mockResolvedValue(undefined),
    cacheGenerateKey: vi.fn().mockResolvedValue('key-123'),
    cacheGet: vi.fn().mockResolvedValue(null),
    cacheSet: vi.fn().mockResolvedValue(undefined),
    checkFileChanged: vi.fn().mockResolvedValue({ changed: false }),
    getUsername: vi.fn().mockResolvedValue('testuser'),
    writeFile: vi.fn().mockResolvedValue({ success: true }),
    readFile: vi.fn().mockResolvedValue('# Hello'),
    watchFile: vi.fn().mockResolvedValue(undefined),
    unwatchFile: vi.fn().mockResolvedValue(undefined),
    saveFile: vi.fn().mockResolvedValue(undefined),
    printToPDF: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    getOpenFilePath: vi.fn().mockResolvedValue(null),
    onFileChanged: vi.fn().mockReturnValue(vi.fn()),
    onPreferencesUpdated: vi.fn().mockReturnValue(vi.fn()),
    onThemeChanged: vi.fn().mockReturnValue(vi.fn()),
  };
}

describe('ElectronMessagingAdapter', () => {
  let adapter: ElectronMessagingAdapter;
  let mockMdview: ReturnType<typeof createMockMdview>;

  beforeEach(() => {
    mockMdview = createMockMdview();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    (globalThis as Record<string, unknown>).window = { mdview: mockMdview } as never;
    adapter = new ElectronMessagingAdapter();
  });

  it('should route GET_STATE to getState()', async () => {
    const result = await adapter.send({ type: 'GET_STATE' });
    expect(mockMdview.getState).toHaveBeenCalled();
    expect(result).toEqual({ preferences: { theme: 'github-light' } });
  });

  it('should route UPDATE_PREFERENCES to updatePreferences()', async () => {
    await adapter.send({
      type: 'UPDATE_PREFERENCES',
      payload: { theme: 'github-dark' },
    });
    expect(mockMdview.updatePreferences).toHaveBeenCalledWith({
      theme: 'github-dark',
    });
  });

  it('should route CACHE_GENERATE_KEY with correct args', async () => {
    const result = await adapter.send({
      type: 'CACHE_GENERATE_KEY',
      payload: {
        filePath: '/tmp/test.md',
        contentHash: 'abc',
        theme: 'github-light',
        preferences: {},
      },
    });
    expect(mockMdview.cacheGenerateKey).toHaveBeenCalledWith(
      '/tmp/test.md',
      'abc',
      'github-light',
      {}
    );
    expect(result).toBe('key-123');
  });

  it('should route CACHE_GET with key', async () => {
    await adapter.send({ type: 'CACHE_GET', payload: { key: 'test-key' } });
    expect(mockMdview.cacheGet).toHaveBeenCalledWith('test-key');
  });

  it('should route CHECK_FILE_CHANGED with url and hash', async () => {
    await adapter.send({
      type: 'CHECK_FILE_CHANGED',
      payload: { url: '/tmp/test.md', lastHash: 'hash123' },
    });
    expect(mockMdview.checkFileChanged).toHaveBeenCalledWith('/tmp/test.md', 'hash123');
  });

  it('should route GET_USERNAME', async () => {
    const result = await adapter.send({ type: 'GET_USERNAME' });
    expect(result).toBe('testuser');
  });

  it('should route WRITE_FILE with path and content', async () => {
    await adapter.send({
      type: 'WRITE_FILE',
      payload: { path: '/tmp/out.md', content: '# New' },
    });
    expect(mockMdview.writeFile).toHaveBeenCalledWith('/tmp/out.md', '# New');
  });

  it('should return undefined for unknown message types', async () => {
    const result = await adapter.send({ type: 'UNKNOWN_TYPE' });
    expect(result).toBeUndefined();
  });
});

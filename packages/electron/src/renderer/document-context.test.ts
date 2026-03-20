import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@mdview/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@mdview/core');
  return {
    ...actual,
    RenderPipeline: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.render = vi.fn().mockResolvedValue(undefined);
      this.onProgress = vi.fn().mockReturnValue(vi.fn());
    }),
    ThemeEngine: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.applyTheme = vi.fn().mockResolvedValue(undefined);
    }),
    TocRenderer: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.render = vi.fn();
    }),
    ExportUI: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.render = vi.fn();
    }),
    CommentManager: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.initialize = vi.fn().mockResolvedValue(undefined);
    }),
    FileScanner: {
      getFileSize: vi.fn().mockReturnValue(100),
    },
  };
});

function createMockMdviewAPI() {
  return {
    getState: vi.fn().mockResolvedValue({
      preferences: {
        theme: 'github-light',
        autoReload: false,
        showToc: false,
        commentsEnabled: false,
      },
      document: { path: '', content: '', scrollPosition: 0, renderState: 'pending' },
      ui: { theme: null, maximizedDiagram: null, visibleDiagrams: new Set() },
    }),
    readFile: vi.fn().mockResolvedValue('# Hello World\n\nSome content here with words.'),
    watchFile: vi.fn().mockResolvedValue(undefined),
    unwatchFile: vi.fn().mockResolvedValue(undefined),
    onFileChanged: vi.fn().mockReturnValue(vi.fn()),
    onPreferencesUpdated: vi.fn().mockReturnValue(vi.fn()),
    onThemeChanged: vi.fn().mockReturnValue(vi.fn()),
    updatePreferences: vi.fn(),
    cacheGenerateKey: vi.fn(),
    cacheGet: vi.fn().mockResolvedValue(null),
    cacheSet: vi.fn(),
    writeFile: vi.fn(),
    checkFileChanged: vi.fn(),
    getUsername: vi.fn().mockResolvedValue('testuser'),
    saveFile: vi.fn(),
    printToPDF: vi.fn(),
    getOpenFilePath: vi.fn(),
    showOpenFileDialog: vi.fn(),
    showOpenFolderDialog: vi.fn(),
    getRecentFiles: vi.fn(),
    addRecentFile: vi.fn(),
    clearRecentFiles: vi.fn(),
    getWorkspaceState: vi.fn(),
    openTab: vi.fn(),
    closeTab: vi.fn(),
    setActiveTab: vi.fn(),
    updateTabMetadata: vi.fn(),
    updateTabScroll: vi.fn(),
    setSidebarVisible: vi.fn(),
    setOpenFolder: vi.fn(),
    listDirectory: vi.fn(),
    watchDirectory: vi.fn(),
    unwatchDirectory: vi.fn(),
    onOpenFile: vi.fn().mockReturnValue(vi.fn()),
    onOpenFolder: vi.fn().mockReturnValue(vi.fn()),
    onMenuCommand: vi.fn().mockReturnValue(vi.fn()),
    onWorkspaceUpdated: vi.fn().mockReturnValue(vi.fn()),
    onTabOpened: vi.fn().mockReturnValue(vi.fn()),
    onTabClosed: vi.fn().mockReturnValue(vi.fn()),
    onActiveTabChanged: vi.fn().mockReturnValue(vi.fn()),
    onDirectoryChanged: vi.fn().mockReturnValue(vi.fn()),
  };
}

describe('DocumentContext', () => {
  let mockMdview: ReturnType<typeof createMockMdviewAPI>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMdview = createMockMdviewAPI();
    (globalThis.window as Record<string, unknown>).mdview = mockMdview;
    document.body.innerHTML = '<div id="test-container"></div>';
  });

  it('should load and render a file', async () => {
    const { DocumentContext } = await import('./document-context');
    const container = document.getElementById('test-container')!;
    const ctx = new DocumentContext('tab-1');
    const metadata = await ctx.load('/tmp/test.md', container);

    expect(mockMdview.readFile).toHaveBeenCalledWith('/tmp/test.md');
    expect(metadata).toBeDefined();
    expect(metadata.filePath).toBe('/tmp/test.md');
  });

  it('should return metadata after load', async () => {
    const { DocumentContext } = await import('./document-context');
    const container = document.getElementById('test-container')!;
    const ctx = new DocumentContext('tab-1');
    const metadata = await ctx.load('/tmp/test.md', container);

    expect(metadata.renderState).toBe('complete');
    expect(metadata.title).toBe('test.md');
    // wordCount is 0 since RenderPipeline is mocked and doesn't populate DOM
    expect(typeof metadata.wordCount).toBe('number');
  });

  it('should store and return scroll position', async () => {
    const { DocumentContext } = await import('./document-context');
    const container = document.getElementById('test-container')!;
    const ctx = new DocumentContext('tab-1');
    await ctx.load('/tmp/test.md', container);

    ctx.setScrollPosition(200);
    expect(ctx.getScrollPosition()).toBe(200);
  });

  it('should reload content', async () => {
    const { DocumentContext } = await import('./document-context');
    const container = document.getElementById('test-container')!;
    const ctx = new DocumentContext('tab-1');
    await ctx.load('/tmp/test.md', container);

    mockMdview.readFile.mockResolvedValue('# Updated');
    await ctx.reload();
    expect(mockMdview.readFile).toHaveBeenCalledTimes(2);
  });

  it('should dispose cleanly', async () => {
    const { DocumentContext } = await import('./document-context');
    const container = document.getElementById('test-container')!;
    const ctx = new DocumentContext('tab-1');
    await ctx.load('/tmp/test.md', container);

    ctx.dispose();
    expect(mockMdview.unwatchFile).toHaveBeenCalledWith('/tmp/test.md');
  });

  it('should get file path', async () => {
    const { DocumentContext } = await import('./document-context');
    const container = document.getElementById('test-container')!;
    const ctx = new DocumentContext('tab-1');
    await ctx.load('/tmp/test.md', container);

    expect(ctx.getFilePath()).toBe('/tmp/test.md');
  });

  it('should return tab id', async () => {
    const { DocumentContext } = await import('./document-context');
    const ctx = new DocumentContext('tab-1');
    expect(ctx.getTabId()).toBe('tab-1');
  });

  it('should handle load errors gracefully', async () => {
    mockMdview.readFile.mockRejectedValue(new Error('File not found'));
    const { DocumentContext } = await import('./document-context');
    const container = document.getElementById('test-container')!;
    const ctx = new DocumentContext('tab-1');

    await expect(ctx.load('/tmp/missing.md', container)).rejects.toThrow('File not found');
  });
});

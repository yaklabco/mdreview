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
      this.toggle = vi.fn();
      this.show = vi.fn();
      this.hide = vi.fn();
    }),
    ExportUI: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.render = vi.fn();
    }),
    CommentManager: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.initialize = vi.fn().mockResolvedValue(undefined);
    }),
    ContentCollector: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.collect = vi.fn().mockReturnValue({ title: 'Test', nodes: [], metadata: {} });
    }),
    SVGConverter: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.convertAll = vi.fn().mockReturnValue(new Map());
    }),
    DOCXGenerator: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.generate = vi.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) });
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
    setSidebarWidth: vi.fn(),
    setOpenFolder: vi.fn(),
    openExternal: vi.fn(),
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

  describe('toggleToc', () => {
    it('should create and show TOC when none exists and container has headings', async () => {
      const { DocumentContext } = await import('./document-context');
      const container = document.getElementById('test-container')!;
      container.innerHTML = '<h1 id="a">Title</h1><h2 id="b">Sub</h2>';
      const ctx = new DocumentContext('tab-1');
      await ctx.load('/tmp/test.md', container);

      ctx.toggleToc();

      const { TocRenderer } = await import('@mdview/core');
      expect(TocRenderer).toHaveBeenCalled();
    });

    it('should toggle existing TOC', async () => {
      mockMdview.getState.mockResolvedValue({
        preferences: {
          theme: 'github-light',
          autoReload: false,
          showToc: true,
          commentsEnabled: false,
        },
        document: { path: '', content: '', scrollPosition: 0, renderState: 'pending' },
        ui: { theme: null, maximizedDiagram: null, visibleDiagrams: new Set() },
      });

      const { DocumentContext } = await import('./document-context');
      const container = document.getElementById('test-container')!;
      container.innerHTML = '<h1 id="a">Title</h1>';
      const ctx = new DocumentContext('tab-1');
      await ctx.load('/tmp/test.md', container);

      // TOC was created by load because showToc=true
      ctx.toggleToc();

      const { TocRenderer } = await import('@mdview/core');
      const mockInstance = (TocRenderer as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value as Record<string, ReturnType<typeof vi.fn>>;
      expect(mockInstance.toggle).toHaveBeenCalled();
    });

    it('should no-op when no container is loaded', async () => {
      const { DocumentContext } = await import('./document-context');
      const ctx = new DocumentContext('tab-1');
      // Should not throw
      ctx.toggleToc();
    });
  });

  describe('exportPDF', () => {
    it('should call printToPDF and saveFile', async () => {
      mockMdview.printToPDF = vi.fn().mockResolvedValue(new ArrayBuffer(10));
      mockMdview.saveFile = vi.fn().mockResolvedValue(undefined);

      const { DocumentContext } = await import('./document-context');
      const container = document.getElementById('test-container')!;
      const ctx = new DocumentContext('tab-1');
      await ctx.load('/tmp/test.md', container);

      await ctx.exportPDF();

      expect(mockMdview.printToPDF).toHaveBeenCalled();
      expect(mockMdview.saveFile).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'test.pdf',
          mimeType: 'application/pdf',
        })
      );
    });

    it('should no-op when no file is loaded', async () => {
      const { DocumentContext } = await import('./document-context');
      const ctx = new DocumentContext('tab-1');
      await ctx.exportPDF();
      expect(mockMdview.printToPDF).not.toHaveBeenCalled();
    });
  });

  describe('exportDOCX', () => {
    it('should generate and save DOCX', async () => {
      mockMdview.saveFile = vi.fn().mockResolvedValue(undefined);

      const { DocumentContext } = await import('./document-context');
      const container = document.getElementById('test-container')!;
      const ctx = new DocumentContext('tab-1');
      await ctx.load('/tmp/test.md', container);

      await ctx.exportDOCX();

      expect(mockMdview.saveFile).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'test.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      );
    });

    it('should no-op when no file is loaded', async () => {
      const { DocumentContext } = await import('./document-context');
      const ctx = new DocumentContext('tab-1');
      await ctx.exportDOCX();
      expect(mockMdview.saveFile).not.toHaveBeenCalled();
    });
  });

  describe('applyTheme', () => {
    it('should call themeEngine.applyTheme', async () => {
      const { DocumentContext, } = await import('./document-context');
      const { ThemeEngine } = await import('@mdview/core');
      const container = document.getElementById('test-container')!;
      const ctx = new DocumentContext('tab-1');
      await ctx.load('/tmp/test.md', container);

      await ctx.applyTheme('github-dark');

      const mockInstance = (ThemeEngine as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value as Record<string, ReturnType<typeof vi.fn>>;
      // applyTheme is called during load and then again explicitly
      expect(mockInstance.applyTheme).toHaveBeenCalledWith('github-dark');
    });
  });

  describe('applyPreferences', () => {
    it('should apply theme when theme is in prefs', async () => {
      const { DocumentContext } = await import('./document-context');
      const { ThemeEngine } = await import('@mdview/core');
      const container = document.getElementById('test-container')!;
      const ctx = new DocumentContext('tab-1');
      await ctx.load('/tmp/test.md', container);

      await ctx.applyPreferences({ theme: 'monokai' });

      const mockInstance = (ThemeEngine as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value as Record<string, ReturnType<typeof vi.fn>>;
      expect(mockInstance.applyTheme).toHaveBeenCalledWith('monokai');
    });

    it('should hide TOC when showToc is false', async () => {
      mockMdview.getState.mockResolvedValue({
        preferences: {
          theme: 'github-light',
          autoReload: false,
          showToc: true,
          commentsEnabled: false,
        },
        document: { path: '', content: '', scrollPosition: 0, renderState: 'pending' },
        ui: { theme: null, maximizedDiagram: null, visibleDiagrams: new Set() },
      });

      const { DocumentContext } = await import('./document-context');
      const { TocRenderer } = await import('@mdview/core');
      const container = document.getElementById('test-container')!;
      container.innerHTML = '<h1 id="a">Title</h1>';
      const ctx = new DocumentContext('tab-1');
      await ctx.load('/tmp/test.md', container);

      await ctx.applyPreferences({ showToc: false });

      const mockInstance = (TocRenderer as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value as Record<string, ReturnType<typeof vi.fn>>;
      expect(mockInstance.hide).toHaveBeenCalled();
    });
  });

  describe('progress callback', () => {
    it('should call progress callback during render when set', async () => {
      const { RenderPipeline } = await import('@mdview/core');
      let capturedProgressListener: ((p: { stage: string; percent: number }) => void) | null = null;
      (RenderPipeline as unknown as ReturnType<typeof vi.fn>).mockImplementation(function (this: Record<string, unknown>) {
        this.render = vi.fn().mockResolvedValue(undefined);
        this.onProgress = vi.fn().mockImplementation((listener: (p: { stage: string; percent: number }) => void) => {
          capturedProgressListener = listener;
          return vi.fn();
        });
      });

      const { DocumentContext } = await import('./document-context');
      const container = document.getElementById('test-container')!;
      const ctx = new DocumentContext('tab-2');

      const progressSpy = vi.fn();
      ctx.setOnProgress(progressSpy);

      await ctx.load('/tmp/test.md', container);

      expect(capturedProgressListener).not.toBeNull();
      capturedProgressListener!({ stage: 'parsing', percent: 50 });
      expect(progressSpy).toHaveBeenCalledWith({ stage: 'parsing', percent: 50 });
    });

    it('should not throw when progress fires without a callback set', async () => {
      const { RenderPipeline } = await import('@mdview/core');
      let capturedProgressListener: ((p: { stage: string; percent: number }) => void) | null = null;
      (RenderPipeline as unknown as ReturnType<typeof vi.fn>).mockImplementation(function (this: Record<string, unknown>) {
        this.render = vi.fn().mockResolvedValue(undefined);
        this.onProgress = vi.fn().mockImplementation((listener: (p: { stage: string; percent: number }) => void) => {
          capturedProgressListener = listener;
          return vi.fn();
        });
      });

      const { DocumentContext } = await import('./document-context');
      const container = document.getElementById('test-container')!;
      const ctx = new DocumentContext('tab-3');

      await ctx.load('/tmp/test.md', container);

      expect(() => capturedProgressListener!({ stage: 'parsing', percent: 50 })).not.toThrow();
    });

    it('should update callback via setOnProgress', async () => {
      const { RenderPipeline } = await import('@mdview/core');
      let capturedProgressListener: ((p: { stage: string; percent: number }) => void) | null = null;
      (RenderPipeline as unknown as ReturnType<typeof vi.fn>).mockImplementation(function (this: Record<string, unknown>) {
        this.render = vi.fn().mockResolvedValue(undefined);
        this.onProgress = vi.fn().mockImplementation((listener: (p: { stage: string; percent: number }) => void) => {
          capturedProgressListener = listener;
          return vi.fn();
        });
      });

      const { DocumentContext } = await import('./document-context');
      const container = document.getElementById('test-container')!;
      const ctx = new DocumentContext('tab-4');

      const spy1 = vi.fn();
      const spy2 = vi.fn();
      ctx.setOnProgress(spy1);
      await ctx.load('/tmp/test.md', container);

      ctx.setOnProgress(spy2);
      capturedProgressListener!({ stage: 'highlighting', percent: 80 });

      expect(spy1).not.toHaveBeenCalled();
      expect(spy2).toHaveBeenCalledWith({ stage: 'highlighting', percent: 80 });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @mdview/core modules
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
    updatePreferences: vi.fn().mockResolvedValue(undefined),
    cacheGenerateKey: vi.fn().mockResolvedValue('key'),
    cacheGet: vi.fn().mockResolvedValue(null),
    cacheSet: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('# Hello World\n\nSome content'),
    writeFile: vi.fn().mockResolvedValue({ success: true }),
    checkFileChanged: vi.fn().mockResolvedValue({ changed: false }),
    watchFile: vi.fn().mockResolvedValue(undefined),
    unwatchFile: vi.fn().mockResolvedValue(undefined),
    getUsername: vi.fn().mockResolvedValue('testuser'),
    saveFile: vi.fn().mockResolvedValue(undefined),
    printToPDF: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    getOpenFilePath: vi.fn().mockResolvedValue('/tmp/test.md'),
    onFileChanged: vi.fn().mockReturnValue(vi.fn()),
    onPreferencesUpdated: vi.fn().mockReturnValue(vi.fn()),
    onThemeChanged: vi.fn().mockReturnValue(vi.fn()),
  };
}

describe('MDViewElectronViewer', () => {
  let mockMdview: ReturnType<typeof createMockMdviewAPI>;

  beforeEach(() => {
    mockMdview = createMockMdviewAPI();
    (globalThis.window as Record<string, unknown>).mdview = mockMdview;

    document.body.innerHTML = '<div id="mdview-container"></div>';
  });

  it('should initialize and render markdown', async () => {
    const { MDViewElectronViewer } = await import('./viewer');
    const viewer = new MDViewElectronViewer();
    await viewer.initialize();

    expect(mockMdview.getOpenFilePath).toHaveBeenCalled();
    expect(mockMdview.readFile).toHaveBeenCalledWith('/tmp/test.md');
    expect(mockMdview.getState).toHaveBeenCalled();
  });

  it('should show message when no file path is provided', async () => {
    mockMdview.getOpenFilePath.mockResolvedValue(null);

    const { MDViewElectronViewer } = await import('./viewer');
    const viewer = new MDViewElectronViewer();
    await viewer.initialize();

    const container = document.getElementById('mdview-container');
    expect(container?.innerHTML).toContain('No file specified');
  });

  it('should add mdview-active class to body', async () => {
    const { MDViewElectronViewer } = await import('./viewer');
    const viewer = new MDViewElectronViewer();
    await viewer.initialize();

    expect(document.body.classList.contains('mdview-active')).toBe(true);
  });

  it('should listen for preference and theme updates', async () => {
    const { MDViewElectronViewer } = await import('./viewer');
    const viewer = new MDViewElectronViewer();
    await viewer.initialize();

    expect(mockMdview.onPreferencesUpdated).toHaveBeenCalled();
    expect(mockMdview.onThemeChanged).toHaveBeenCalled();
  });

  it('should handle missing container gracefully', async () => {
    document.body.innerHTML = '';

    const { MDViewElectronViewer } = await import('./viewer');
    const viewer = new MDViewElectronViewer();

    // Should not throw
    await viewer.initialize();
  });
});

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

    // Workspace methods
    showOpenFileDialog: vi.fn().mockResolvedValue(null),
    showOpenFolderDialog: vi.fn().mockResolvedValue(null),
    getRecentFiles: vi.fn().mockResolvedValue([]),
    addRecentFile: vi.fn().mockResolvedValue(undefined),
    clearRecentFiles: vi.fn().mockResolvedValue(undefined),
    getWorkspaceState: vi.fn().mockResolvedValue({
      tabs: [],
      activeTabId: null,
      sidebarVisible: true,
      sidebarWidth: 250,
      openFolderPath: null,
      statusBarVisible: true,
    }),
    openTab: vi.fn().mockImplementation((filePath: string) =>
      Promise.resolve({
        id: `tab-${filePath.replace(/[^a-z0-9]/g, '')}`,
        filePath,
        title: filePath.split('/').pop(),
        scrollPosition: 0,
        renderState: 'pending',
      })
    ),
    closeTab: vi.fn().mockResolvedValue(undefined),
    setActiveTab: vi.fn().mockResolvedValue(undefined),
    updateTabMetadata: vi.fn().mockResolvedValue(undefined),
    updateTabScroll: vi.fn().mockResolvedValue(undefined),
    setSidebarVisible: vi.fn().mockResolvedValue(undefined),
    setSidebarWidth: vi.fn().mockResolvedValue(undefined),
    setOpenFolder: vi.fn().mockResolvedValue(undefined),
    openExternal: vi.fn().mockResolvedValue(undefined),
    listDirectory: vi.fn().mockResolvedValue([]),
    watchDirectory: vi.fn().mockResolvedValue(undefined),
    unwatchDirectory: vi.fn().mockResolvedValue(undefined),
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

describe('MDViewElectronViewer', () => {
  let mockMdview: ReturnType<typeof createMockMdviewAPI>;

  beforeEach(() => {
    mockMdview = createMockMdviewAPI();
    (globalThis.window as Record<string, unknown>).mdview = mockMdview;

    document.body.innerHTML = `
      <div id="mdview-workspace">
        <div id="mdview-sidebar"></div>
        <div id="mdview-main">
          <div id="mdview-tab-bar"></div>
          <div id="mdview-content-area">
            <div id="mdview-container"></div>
          </div>
          <div id="mdview-status-bar"></div>
        </div>
      </div>
    `;
  });

  it('should initialize and open file from CLI args', async () => {
    const { MDViewElectronViewer } = await import('./viewer');
    const viewer = new MDViewElectronViewer();
    await viewer.initialize();

    expect(mockMdview.getOpenFilePath).toHaveBeenCalled();
    expect(mockMdview.openTab).toHaveBeenCalledWith('/tmp/test.md');
    expect(viewer.getTabCount()).toBe(1);
  });

  it('should show empty state when no file path is provided', async () => {
    mockMdview.getOpenFilePath.mockResolvedValue(null);

    const { MDViewElectronViewer } = await import('./viewer');
    const viewer = new MDViewElectronViewer();
    await viewer.initialize();

    const emptyState = document.getElementById('mdview-empty-state');
    expect(emptyState).not.toBeNull();
    expect(viewer.getTabCount()).toBe(0);
  });

  it('should open multiple files as tabs', async () => {
    mockMdview.getOpenFilePath.mockResolvedValue(null);

    const { MDViewElectronViewer } = await import('./viewer');
    const viewer = new MDViewElectronViewer();
    await viewer.initialize();

    await viewer.openFile('/tmp/a.md');
    await viewer.openFile('/tmp/b.md');

    expect(viewer.getTabCount()).toBe(2);
  });

  it('should deduplicate when opening same file', async () => {
    mockMdview.getOpenFilePath.mockResolvedValue(null);

    const { MDViewElectronViewer } = await import('./viewer');
    const viewer = new MDViewElectronViewer();
    await viewer.initialize();

    await viewer.openFile('/tmp/a.md');
    await viewer.openFile('/tmp/a.md');

    expect(viewer.getTabCount()).toBe(1);
  });

  it('should close a tab and show empty state if last', async () => {
    const { MDViewElectronViewer } = await import('./viewer');
    const viewer = new MDViewElectronViewer();
    await viewer.initialize();

    const activeTabId = viewer.getActiveTabId();
    expect(activeTabId).not.toBeNull();

    await viewer.closeFile(activeTabId!);

    expect(viewer.getTabCount()).toBe(0);
    const emptyState = document.getElementById('mdview-empty-state');
    expect(emptyState?.style.display).not.toBe('none');
  });

  it('should listen for IPC events', async () => {
    const { MDViewElectronViewer } = await import('./viewer');
    const viewer = new MDViewElectronViewer();
    await viewer.initialize();

    expect(mockMdview.onOpenFile).toHaveBeenCalled();
    expect(mockMdview.onMenuCommand).toHaveBeenCalled();
    expect(mockMdview.onPreferencesUpdated).toHaveBeenCalled();
    expect(mockMdview.onThemeChanged).toHaveBeenCalled();
  });

  it('should add mdview-active class on file load', async () => {
    const { MDViewElectronViewer } = await import('./viewer');
    const viewer = new MDViewElectronViewer();
    await viewer.initialize();

    expect(document.body.classList.contains('mdview-active')).toBe(true);
  });

  it('should handle missing workspace elements gracefully', async () => {
    document.body.innerHTML = '';

    const { MDViewElectronViewer } = await import('./viewer');
    const viewer = new MDViewElectronViewer();
    // Should not throw
    await viewer.initialize();
  });
});

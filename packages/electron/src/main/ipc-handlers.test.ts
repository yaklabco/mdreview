import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IPC_CHANNELS } from '../shared/ipc-channels';

// Track registered handlers
const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    }),
    removeHandler: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/tmp/test.md'] }),
  },
  shell: {
    openExternal: vi.fn().mockResolvedValue(undefined),
    showItemInFolder: vi.fn(),
  },
  Menu: {
    buildFromTemplate: vi.fn().mockReturnValue({
      popup: vi.fn(),
    }),
  },
}));

// Import after mock
const { registerIpcHandlers } = await import('./ipc-handlers');

function createMockDeps() {
  return {
    stateManager: {
      getState: vi.fn().mockReturnValue({
        preferences: { theme: 'github-light' },
        document: { path: '' },
        ui: { theme: null },
      }),
      updatePreferences: vi.fn(),
      getWorkspaceState: vi.fn().mockReturnValue({
        tabs: [],
        activeTabId: null,
        sidebarVisible: true,
        sidebarWidth: 250,
        openFolderPath: null,
        statusBarVisible: true,
      }),
      openTab: vi.fn().mockReturnValue({ id: 'tab-1', filePath: '/tmp/test.md', title: 'test.md' }),
      closeTab: vi.fn(),
      setActiveTab: vi.fn(),
      updateTabMetadata: vi.fn(),
      updateTabScrollPosition: vi.fn(),
      setSidebarVisible: vi.fn(),
      setSidebarWidth: vi.fn(),
      setOpenFolder: vi.fn(),
    },
    cacheManager: {
      generateKey: vi.fn().mockResolvedValue('cache-key-123'),
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
    },
    fileAdapter: {
      readFile: vi.fn().mockResolvedValue('# Hello'),
      writeFile: vi.fn().mockResolvedValue({ success: true }),
      checkChanged: vi.fn().mockResolvedValue({ changed: false }),
      watch: vi.fn().mockReturnValue(vi.fn()),
      dispose: vi.fn(),
    },
    identityAdapter: {
      getUsername: vi.fn().mockResolvedValue('testuser'),
    },
    exportAdapter: {
      saveFile: vi.fn(),
      printToPDF: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    },
    getWindow: vi.fn().mockReturnValue({
      webContents: { send: vi.fn() },
      isDestroyed: vi.fn().mockReturnValue(false),
    }),
    getOpenFilePath: vi.fn().mockReturnValue('/tmp/test.md'),
  };
}

describe('IPC Handlers', () => {
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    handlers.clear();
    deps = createMockDeps();
    registerIpcHandlers(deps as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should register all expected channels', () => {
    const expectedChannels = [
      IPC_CHANNELS.GET_STATE,
      IPC_CHANNELS.UPDATE_PREFERENCES,
      IPC_CHANNELS.CACHE_GENERATE_KEY,
      IPC_CHANNELS.CACHE_GET,
      IPC_CHANNELS.CACHE_SET,
      IPC_CHANNELS.READ_FILE,
      IPC_CHANNELS.WRITE_FILE,
      IPC_CHANNELS.CHECK_FILE_CHANGED,
      IPC_CHANNELS.WATCH_FILE,
      IPC_CHANNELS.UNWATCH_FILE,
      IPC_CHANNELS.GET_USERNAME,
      IPC_CHANNELS.SAVE_FILE,
      IPC_CHANNELS.PRINT_TO_PDF,
      IPC_CHANNELS.GET_OPEN_FILE_PATH,
      IPC_CHANNELS.SHOW_OPEN_FILE_DIALOG,
      IPC_CHANNELS.SHOW_OPEN_FOLDER_DIALOG,
      IPC_CHANNELS.GET_RECENT_FILES,
      IPC_CHANNELS.ADD_RECENT_FILE,
      IPC_CHANNELS.CLEAR_RECENT_FILES,
      IPC_CHANNELS.GET_WORKSPACE_STATE,
      IPC_CHANNELS.OPEN_TAB,
      IPC_CHANNELS.CLOSE_TAB,
      IPC_CHANNELS.SET_ACTIVE_TAB,
      IPC_CHANNELS.UPDATE_TAB_METADATA,
      IPC_CHANNELS.UPDATE_TAB_SCROLL,
      IPC_CHANNELS.SET_SIDEBAR_VISIBLE,
      IPC_CHANNELS.SET_SIDEBAR_WIDTH,
      IPC_CHANNELS.SET_OPEN_FOLDER,
      IPC_CHANNELS.OPEN_EXTERNAL,
      IPC_CHANNELS.SHOW_CONTEXT_MENU,
      IPC_CHANNELS.REVEAL_IN_FINDER,
      IPC_CHANNELS.LIST_DIRECTORY,
      IPC_CHANNELS.WATCH_DIRECTORY,
      IPC_CHANNELS.UNWATCH_DIRECTORY,
    ];
    for (const channel of expectedChannels) {
      expect(handlers.has(channel)).toBe(true);
    }
  });

  it('GET_STATE should return state from stateManager', async () => {
    const handler = handlers.get(IPC_CHANNELS.GET_STATE);
    const result = await handler?.();
    expect(deps.stateManager.getState).toHaveBeenCalled();
    expect(result).toEqual(deps.stateManager.getState());
  });

  it('UPDATE_PREFERENCES should update and notify renderer', async () => {
    const handler = handlers.get(IPC_CHANNELS.UPDATE_PREFERENCES);
    const prefs = { theme: 'github-dark' };
    await handler?.({}, prefs);
    expect(deps.stateManager.updatePreferences).toHaveBeenCalledWith(prefs);
    expect(deps.getWindow).toHaveBeenCalled();
    const mockWin = deps.getWindow() as { webContents: { send: ReturnType<typeof vi.fn> } };
    expect(mockWin.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.PREFERENCES_UPDATED, prefs);
  });

  it('CACHE_GENERATE_KEY should return a hex hash string', async () => {
    const handler = handlers.get(IPC_CHANNELS.CACHE_GENERATE_KEY);
    const result = await handler?.({}, 'path', 'hash', 'theme', {});
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('READ_FILE should delegate to fileAdapter', async () => {
    const handler = handlers.get(IPC_CHANNELS.READ_FILE);
    const result = await handler?.({}, '/tmp/test.md');
    expect(result).toBe('# Hello');
    expect(deps.fileAdapter.readFile).toHaveBeenCalledWith('/tmp/test.md');
  });

  it('WRITE_FILE should delegate to fileAdapter', async () => {
    const handler = handlers.get(IPC_CHANNELS.WRITE_FILE);
    const result = await handler?.({}, '/tmp/out.md', 'content');
    expect(result).toEqual({ success: true });
  });

  it('GET_USERNAME should delegate to identityAdapter', async () => {
    const handler = handlers.get(IPC_CHANNELS.GET_USERNAME);
    const result = await handler?.();
    expect(result).toBe('testuser');
  });

  it('GET_OPEN_FILE_PATH should return path from deps', async () => {
    const handler = handlers.get(IPC_CHANNELS.GET_OPEN_FILE_PATH);
    const result = await handler?.();
    expect(result).toBe('/tmp/test.md');
  });

  it('WATCH_FILE should set up watcher and notify on change', async () => {
    let watchCallback: (() => void) | undefined;
    deps.fileAdapter.watch.mockImplementation((_path: string, cb: () => void) => {
      watchCallback = cb;
      return vi.fn();
    });

    // Re-register with new mock
    handlers.clear();
    registerIpcHandlers(deps as never);

    const watchHandler = handlers.get(IPC_CHANNELS.WATCH_FILE);
    await watchHandler?.({}, '/tmp/test.md');

    expect(deps.fileAdapter.watch).toHaveBeenCalledWith('/tmp/test.md', expect.any(Function));

    // Simulate file change
    watchCallback?.();
    const mockWin = deps.getWindow() as { webContents: { send: ReturnType<typeof vi.fn> } };
    expect(mockWin.webContents.send).toHaveBeenCalledWith(
      IPC_CHANNELS.FILE_CHANGED,
      '/tmp/test.md'
    );
  });

  it('SET_SIDEBAR_WIDTH should delegate to stateManager', async () => {
    const handler = handlers.get(IPC_CHANNELS.SET_SIDEBAR_WIDTH);
    await handler?.({}, 350);
    expect(deps.stateManager.setSidebarWidth).toHaveBeenCalledWith(350);
  });

  it('OPEN_EXTERNAL should call shell.openExternal', async () => {
    const electron = await import('electron');
    const handler = handlers.get(IPC_CHANNELS.OPEN_EXTERNAL);
    await handler?.({}, 'https://github.com/test');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(electron.shell.openExternal).toHaveBeenCalledWith('https://github.com/test');
  });

  it('should not send to destroyed window', async () => {
    const destroyedWin = {
      webContents: { send: vi.fn() },
      isDestroyed: vi.fn().mockReturnValue(true),
    };
    deps.getWindow.mockReturnValue(destroyedWin);

    handlers.clear();
    registerIpcHandlers(deps as never);

    const handler = handlers.get(IPC_CHANNELS.SET_ACTIVE_TAB);
    await handler?.({}, 'tab-1');

    expect(destroyedWin.webContents.send).not.toHaveBeenCalled();
  });

  it('dispose should clean up all file watchers', () => {
    const unwatchFn1 = vi.fn();
    const unwatchFn2 = vi.fn();
    let callCount = 0;
    deps.fileAdapter.watch.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? unwatchFn1 : unwatchFn2;
    });

    handlers.clear();
    const dispose = registerIpcHandlers(deps as never);

    const watchHandler = handlers.get(IPC_CHANNELS.WATCH_FILE);
    void watchHandler?.({}, '/tmp/a.md');
    void watchHandler?.({}, '/tmp/b.md');

    dispose();

    expect(unwatchFn1).toHaveBeenCalled();
    expect(unwatchFn2).toHaveBeenCalled();
  });

  it('LIST_DIRECTORY should pass options to directoryService', async () => {
    const mockDirectoryService = {
      listDirectory: vi.fn().mockResolvedValue([]),
      watchDirectory: vi.fn(),
      unwatchDirectory: vi.fn(),
      dispose: vi.fn(),
    };
    handlers.clear();
    registerIpcHandlers({ ...deps, directoryService: mockDirectoryService } as never);

    const handler = handlers.get(IPC_CHANNELS.LIST_DIRECTORY);
    await handler?.({}, '/tmp/folder', { showAllFiles: true });
    expect(mockDirectoryService.listDirectory).toHaveBeenCalledWith('/tmp/folder', {
      showAllFiles: true,
    });
  });

  it('UNWATCH_FILE should clean up watcher', async () => {
    const unwatchFn = vi.fn();
    deps.fileAdapter.watch.mockReturnValue(unwatchFn);

    handlers.clear();
    registerIpcHandlers(deps as never);

    const watchHandler = handlers.get(IPC_CHANNELS.WATCH_FILE);
    await watchHandler?.({}, '/tmp/test.md');

    const unwatchHandler = handlers.get(IPC_CHANNELS.UNWATCH_FILE);
    await unwatchHandler?.({}, '/tmp/test.md');

    expect(unwatchFn).toHaveBeenCalled();
  });

  describe('SHOW_CONTEXT_MENU', () => {
    it('should build menu with selection items when text is selected', async () => {
      const electron = await import('electron');
      const handler = handlers.get(IPC_CHANNELS.SHOW_CONTEXT_MENU);
      await handler?.(
        {},
        {
          hasSelection: true,
          selectionText: 'hello world',
          filePath: '/tmp/test.md',
        }
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(vi.mocked(electron.Menu.buildFromTemplate)).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Copy', accelerator: 'CmdOrCtrl+C' }),
          expect.objectContaining({ label: 'Leave a Comment' }),
          expect.objectContaining({
            label: expect.stringContaining('Look Up') as string,
          }),
          expect.objectContaining({ label: 'Search with Google' }),
          expect.objectContaining({ label: 'Select All', accelerator: 'CmdOrCtrl+A' }),
        ])
      );
    });

    it('should build menu without selection items when no text is selected', async () => {
      const electron = await import('electron');
      const handler = handlers.get(IPC_CHANNELS.SHOW_CONTEXT_MENU);
      await handler?.(
        {},
        {
          hasSelection: false,
          selectionText: '',
          filePath: '/tmp/test.md',
        }
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      const template = vi.mocked(electron.Menu.buildFromTemplate).mock.calls[0][0] as Array<{
        label?: string;
      }>;
      const labels = template.filter((item) => item.label).map((item) => item.label);
      expect(labels).toContain('Select All');
      expect(labels).toContain('Copy File Path');
      expect(labels).toContain('Reveal in Finder');
      expect(labels).toContain('Reload');
      expect(labels).not.toContain('Copy');
      expect(labels).not.toContain('Leave a Comment');
    });

    it('should send context:copy command when Copy is clicked', async () => {
      const electron = await import('electron');
      const handler = handlers.get(IPC_CHANNELS.SHOW_CONTEXT_MENU);
      await handler?.(
        {},
        {
          hasSelection: true,
          selectionText: 'test',
          filePath: '/tmp/test.md',
        }
      );

      const template = (electron.Menu.buildFromTemplate as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as Array<{ label?: string; click?: () => void }>;
      const copyItem = template.find((item) => item.label === 'Copy');
      copyItem?.click?.();

      const mockWin = deps.getWindow() as { webContents: { send: ReturnType<typeof vi.fn> } };
      expect(mockWin.webContents.send).toHaveBeenCalledWith(
        IPC_CHANNELS.MENU_COMMAND,
        'context:copy'
      );
    });

    it('should send context:comment command when Leave a Comment is clicked', async () => {
      const electron = await import('electron');
      const handler = handlers.get(IPC_CHANNELS.SHOW_CONTEXT_MENU);
      await handler?.(
        {},
        {
          hasSelection: true,
          selectionText: 'test',
          filePath: '/tmp/test.md',
        }
      );

      const template = (electron.Menu.buildFromTemplate as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as Array<{ label?: string; click?: () => void }>;
      const commentItem = template.find((item) => item.label === 'Leave a Comment');
      commentItem?.click?.();

      const mockWin = deps.getWindow() as { webContents: { send: ReturnType<typeof vi.fn> } };
      expect(mockWin.webContents.send).toHaveBeenCalledWith(
        IPC_CHANNELS.MENU_COMMAND,
        'context:comment'
      );
    });

    it('should truncate long selection text in Look Up label', async () => {
      const electron = await import('electron');
      const handler = handlers.get(IPC_CHANNELS.SHOW_CONTEXT_MENU);
      await handler?.(
        {},
        {
          hasSelection: true,
          selectionText: 'a very long selection text that should be truncated',
          filePath: '/tmp/test.md',
        }
      );

      const template = (electron.Menu.buildFromTemplate as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as Array<{ label?: string }>;
      const lookupItem = template.find((item) => item.label?.startsWith('Look Up'));
      expect(lookupItem?.label).toMatch(/\.\.\."/);
    });

    it('should call menu.popup()', async () => {
      const electron = await import('electron');
      const mockMenu = { popup: vi.fn() };
      (electron.Menu.buildFromTemplate as ReturnType<typeof vi.fn>).mockReturnValue(mockMenu);

      const handler = handlers.get(IPC_CHANNELS.SHOW_CONTEXT_MENU);
      await handler?.(
        {},
        {
          hasSelection: false,
          selectionText: '',
          filePath: '/tmp/test.md',
        }
      );

      expect(mockMenu.popup).toHaveBeenCalled();
    });
  });

  describe('REVEAL_IN_FINDER', () => {
    it('should call shell.showItemInFolder with the file path', async () => {
      const electron = await import('electron');
      const handler = handlers.get(IPC_CHANNELS.REVEAL_IN_FINDER);
      await handler?.({}, '/tmp/test.md');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(vi.mocked(electron.shell.showItemInFolder)).toHaveBeenCalledWith('/tmp/test.md');
    });
  });
});

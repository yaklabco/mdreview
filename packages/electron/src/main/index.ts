import { app, BrowserWindow, dialog } from 'electron';
import { join, extname, basename } from 'path';
import ElectronStore from 'electron-store';
import { CacheManager } from '@mdview/core/node';
import { ElectronStorageAdapter } from './adapters/storage-adapter';
import { ElectronFileAdapter } from './adapters/file-adapter';
import { ElectronIdentityAdapter } from './adapters/identity-adapter';
import { ElectronExportAdapter } from './adapters/export-adapter';
import { StateManager } from './state-manager';
import { registerIpcHandlers } from './ipc-handlers';
import { RecentFilesManager } from './recent-files';
import { SessionManager } from './session-restore';
import { DirectoryService } from './directory-service';
import { buildApplicationMenu } from './menu';
import { IPC_CHANNELS } from '../shared/ipc-channels';

const MD_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx']);

let mainWindow: BrowserWindow | null = null;
let openFilePath: string | null = null;
let stateManagerRef: StateManager | null = null;
let sessionManagerRef: SessionManager | null = null;
let recentFilesRef: RecentFilesManager | null = null;

function parseOpenFilePath(): string | null {
  const args = process.argv.slice(app.isPackaged ? 1 : 2);
  for (const arg of args) {
    if (!arg.startsWith('-') && MD_EXTENSIONS.has(extname(arg).toLowerCase())) {
      return arg;
    }
  }
  return null;
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

function updateWindowTitle(filePath: string | null): void {
  if (!mainWindow) return;
  if (filePath) {
    mainWindow.setTitle(`${basename(filePath)} — mdview`);
  } else {
    mainWindow.setTitle('mdview');
  }
}

function sendOpenFileToRenderer(path: string): void {
  if (mainWindow) {
    mainWindow.webContents.send(IPC_CHANNELS.OPEN_FILE, path);
    updateWindowTitle(path);
  }
}

function openFileDialog(): void {
  if (!mainWindow) return;
  void dialog
    .showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdx'] },
      ],
    })
    .then((result) => {
      if (!result.canceled) {
        for (const filePath of result.filePaths) {
          sendOpenFileToRenderer(filePath);
        }
      }
    });
}

function openFolderDialog(): void {
  if (!mainWindow) return;
  void dialog
    .showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    })
    .then((result) => {
      if (!result.canceled && result.filePaths[0]) {
        mainWindow?.webContents.send(IPC_CHANNELS.OPEN_FOLDER, result.filePaths[0]);
      }
    });
}

function rebuildMenu(): void {
  buildApplicationMenu({
    onOpenFile: openFileDialog,
    onOpenFolder: openFolderDialog,
    getRecentFiles: () => recentFilesRef?.getFiles() ?? [],
    onClearRecent: () => {
      recentFilesRef?.clear();
      rebuildMenu();
    },
    onCloseTab: () => {
      mainWindow?.webContents.send(IPC_CHANNELS.MENU_COMMAND, 'close-tab');
    },
    onToggleSidebar: () => {
      mainWindow?.webContents.send(IPC_CHANNELS.MENU_COMMAND, 'toggle-sidebar');
    },
    onToggleToc: () => {
      mainWindow?.webContents.send(IPC_CHANNELS.MENU_COMMAND, 'toggle-toc');
    },
    onMenuCommand: (command: string) => {
      if (command.startsWith('open:')) {
        sendOpenFileToRenderer(command.slice(5));
      } else {
        mainWindow?.webContents.send(IPC_CHANNELS.MENU_COMMAND, command);
      }
    },
  });
}

function saveSession(): void {
  if (!stateManagerRef || !sessionManagerRef) return;
  const ws = stateManagerRef.getWorkspaceState();
  sessionManagerRef.saveSession({
    tabs: ws.tabs.map((t) => t.filePath),
    activeIndex: ws.activeTabId ? ws.tabs.findIndex((t) => t.id === ws.activeTabId) : 0,
  });
}

void app.whenReady().then(async () => {
  openFilePath = parseOpenFilePath();

  const syncStore = new ElectronStore({ name: 'preferences' });
  const localStore = new ElectronStore({ name: 'local' });

  const storageAdapter = new ElectronStorageAdapter(syncStore, localStore);
  const fileAdapter = new ElectronFileAdapter();
  const identityAdapter = new ElectronIdentityAdapter();
  const cacheManager = new CacheManager({ maxSize: 50, maxAge: 3600000 });
  const stateManager = new StateManager(storageAdapter);
  const recentFiles = new RecentFilesManager(localStore);
  const sessionManager = new SessionManager(localStore);
  const directoryService = new DirectoryService();

  stateManagerRef = stateManager;
  sessionManagerRef = sessionManager;
  recentFilesRef = recentFiles;

  await stateManager.initialize();

  mainWindow = createWindow();

  const win = mainWindow;
  const exportAdapter = new ElectronExportAdapter(
    (options) => dialog.showSaveDialog(win, options),
    (options) => win.webContents.printToPDF(options ?? {})
  );

  registerIpcHandlers({
    stateManager,
    cacheManager,
    fileAdapter,
    identityAdapter,
    exportAdapter,
    recentFiles,
    directoryService,
    getWindow: () => mainWindow,
    getOpenFilePath: () => openFilePath,
  });

  // Build application menu
  rebuildMenu();

  // Update window title when active tab changes
  mainWindow.webContents.on('did-finish-load', () => {
    updateWindowTitle(openFilePath);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });

  mainWindow.on('closed', () => {
    saveSession();
    fileAdapter.dispose();
    directoryService.dispose();
    mainWindow = null;
  });

  app.on('before-quit', () => {
    saveSession();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle file open from OS (macOS) — send to renderer instead of reloading page
app.on('open-file', (_event, path) => {
  if (mainWindow) {
    sendOpenFileToRenderer(path);
  } else {
    // App not ready yet — store for initial load
    openFilePath = path;
  }
});

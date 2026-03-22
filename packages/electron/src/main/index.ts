import { app, BrowserWindow, dialog, protocol, net, nativeImage } from 'electron';
import { join, extname, basename } from 'path';
import { pathToFileURL } from 'url';
import ElectronStore from 'electron-store';
import { CacheManager } from '@mdreview/core/node';
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

// Theme background colors for BrowserWindow — avoids white flash before renderer loads
const THEME_BACKGROUNDS: Record<string, string> = {
  'github-light': '#ffffff',
  'github-dark': '#0d1117',
  'catppuccin-latte': '#eff1f5',
  'catppuccin-frappe': '#303446',
  'catppuccin-macchiato': '#24273a',
  'catppuccin-mocha': '#1e1e2e',
  monokai: '#272822',
  'monokai-pro': '#2d2a2e',
  'one-dark-pro': '#282c34',
};

// Set the app name for the Dock and menu bar (dev mode uses package.json name otherwise)
app.setName('Design Review');

// Register custom protocol for serving local assets (images, etc.)
// Must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-asset',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

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

function getAppIcon(): Electron.NativeImage | undefined {
  // In packaged builds, macOS uses icon.icns from the app bundle automatically.
  // In dev mode, load from the build directory.
  if (app.isPackaged) return undefined;
  const iconPath = join(__dirname, '../../build/icon.png');
  try {
    return nativeImage.createFromPath(iconPath);
  } catch {
    return undefined;
  }
}

function createWindow(backgroundColor?: string): BrowserWindow {
  const icon = getAppIcon();
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    backgroundColor: backgroundColor || '#ffffff',
    icon,
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
    mainWindow.setTitle(`${basename(filePath)} — Design Review`);
  } else {
    mainWindow.setTitle('Design Review');
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
    onToggleTabBar: () => {
      mainWindow?.webContents.send(IPC_CHANNELS.MENU_COMMAND, 'toggle-tab-bar');
    },
    onToggleHeaderBar: () => {
      mainWindow?.webContents.send(IPC_CHANNELS.MENU_COMMAND, 'toggle-header-bar');
    },
    onToggleStatusBar: () => {
      mainWindow?.webContents.send(IPC_CHANNELS.MENU_COMMAND, 'toggle-status-bar');
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
  // Handle local-asset:// protocol — serves local files for relative image/link paths.
  // Because local-asset is a standard scheme, the browser parses
  // local-asset:///Volumes/Code/file.jpg as host="volumes", path="/Code/file.jpg"
  // (hostname is lowercased per URL spec). We reconstruct the original absolute
  // path from the raw URL to preserve case.
  protocol.handle('local-asset', (request) => {
    try {
      // Extract path directly from raw URL to preserve original case.
      // Format: local-asset:///absolute/path or local-asset://host/path
      const raw = decodeURIComponent(request.url.replace(/^local-asset:\/\//, ''));
      const filePath = raw.startsWith('/') ? raw : `/${raw}`;
      return net.fetch(pathToFileURL(filePath).href);
    } catch (err) {
      console.error('[mdreview] local-asset protocol error:', request.url, err);
      return new Response('Not Found', { status: 404 });
    }
  });

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

  // Set Dock icon in dev mode (packaged builds use icon.icns from the bundle)
  if (!app.isPackaged && process.platform === 'darwin') {
    const dockIcon = getAppIcon();
    if (dockIcon) app.dock.setIcon(dockIcon);
  }

  const themeName = stateManager.getPreferences().theme || 'github-light';
  const themeBg = THEME_BACKGROUNDS[themeName] || '#ffffff';
  mainWindow = createWindow(themeBg);

  const win = mainWindow;
  const exportAdapter = new ElectronExportAdapter(
    (options) => dialog.showSaveDialog(win, options),
    (options) => win.webContents.printToPDF(options ?? {})
  );

  const disposeIpcWatchers = registerIpcHandlers({
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
      const activateTheme = stateManagerRef?.getPreferences().theme || 'github-light';
      const activateBg = THEME_BACKGROUNDS[activateTheme] || '#ffffff';
      mainWindow = createWindow(activateBg);
    }
  });

  mainWindow.on('close', () => {
    // Clean up watchers BEFORE the window is destroyed to prevent
    // callbacks firing on a destroyed webContents.
    saveSession();
    disposeIpcWatchers();
    directoryService.dispose();
    fileAdapter.dispose();
  });

  mainWindow.on('closed', () => {
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

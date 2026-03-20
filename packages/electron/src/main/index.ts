import { app, BrowserWindow, dialog } from 'electron';
import { join, extname } from 'path';
import ElectronStore from 'electron-store';
import { CacheManager } from '@mdview/core';
import { ElectronStorageAdapter } from './adapters/storage-adapter';
import { ElectronFileAdapter } from './adapters/file-adapter';
import { ElectronIdentityAdapter } from './adapters/identity-adapter';
import { ElectronExportAdapter } from './adapters/export-adapter';
import { StateManager } from './state-manager';
import { registerIpcHandlers } from './ipc-handlers';

const MD_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx']);

let mainWindow: BrowserWindow | null = null;
let openFilePath: string | null = null;

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

void app.whenReady().then(async () => {
  openFilePath = parseOpenFilePath();

  const syncStore = new ElectronStore({ name: 'preferences' });
  const localStore = new ElectronStore({ name: 'local' });

  const storageAdapter = new ElectronStorageAdapter(syncStore, localStore);
  const fileAdapter = new ElectronFileAdapter();
  const identityAdapter = new ElectronIdentityAdapter();
  const cacheManager = new CacheManager({ maxSize: 50, maxAge: 3600000 });
  const stateManager = new StateManager(storageAdapter);

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
    getWindow: () => mainWindow,
    getOpenFilePath: () => openFilePath,
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });

  mainWindow.on('closed', () => {
    fileAdapter.dispose();
    mainWindow = null;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle file open from OS (macOS)
app.on('open-file', (_event, path) => {
  openFilePath = path;
  if (mainWindow) {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
});

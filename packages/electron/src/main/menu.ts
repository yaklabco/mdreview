import { Menu, app } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

export interface MenuDeps {
  onOpenFile: () => void;
  onOpenFolder: () => void;
  getRecentFiles: () => string[];
  onClearRecent: () => void;
  onCloseTab: () => void;
  onToggleSidebar: () => void;
  onToggleToc: () => void;
  onToggleTabBar: () => void;
  onToggleHeaderBar: () => void;
  onToggleStatusBar: () => void;
  onMenuCommand: (command: string) => void;
}

export function buildApplicationMenu(deps: MenuDeps): void {
  const {
    onOpenFile,
    onOpenFolder,
    getRecentFiles,
    onClearRecent,
    onCloseTab,
    onToggleSidebar,
    onToggleToc,
    onToggleTabBar,
    onToggleHeaderBar,
    onToggleStatusBar,
    onMenuCommand,
  } = deps;

  const recentFiles = getRecentFiles();
  const recentSubmenu: MenuItemConstructorOptions[] = [
    ...recentFiles.map(
      (filePath): MenuItemConstructorOptions => ({
        label: filePath,
        click: () => onMenuCommand(`open:${filePath}`),
      })
    ),
    { type: 'separator' },
    { label: 'Clear Recent', click: onClearRecent },
  ];

  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Preferences...',
                accelerator: 'CmdOrCtrl+,',
                click: () => onMenuCommand('preferences'),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: onOpenFile,
        },
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: onOpenFolder,
        },
        {
          label: 'Recent Files',
          submenu: recentSubmenu,
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: onCloseTab,
        },
        ...(isMac ? [] : [{ type: 'separator' as const }, { role: 'quit' as const }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: onToggleSidebar,
        },
        {
          label: 'Toggle Tab Bar',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: onToggleTabBar,
        },
        {
          label: 'Toggle Header Bar',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: onToggleHeaderBar,
        },
        {
          label: 'Toggle Table of Contents',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: onToggleToc,
        },
        {
          label: 'Toggle Status Bar',
          click: onToggleStatusBar,
        },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Export',
      submenu: [
        {
          label: 'Export...',
          accelerator: 'CmdOrCtrl+E',
          click: () => onMenuCommand('export:modal'),
        },
        { type: 'separator' },
        {
          label: 'Export as PDF...',
          click: () => onMenuCommand('export:pdf'),
        },
        {
          label: 'Export as DOCX...',
          click: () => onMenuCommand('export:docx'),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Design Review',
          click: () => onMenuCommand('help:about'),
        },
        {
          label: 'View on GitHub',
          click: () => onMenuCommand('help:github'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

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
          label: 'Toggle Table of Contents',
          click: onToggleToc,
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
          label: 'About mdview',
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

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

import { TabManager } from './tab-manager';
import { DocumentContext } from './document-context';
import { StatusBar } from './status-bar';
import { DocumentHeaderBar } from './document-header-bar';
import { registerKeyboardShortcuts } from './keyboard-shortcuts';
import { setupDragAndDrop } from './drag-drop';
import { FileTree } from './file-tree';
import { SidebarResizeHandle } from './sidebar-resize';
import { PreferencesPanel } from './preferences-panel';
import { ExportModal } from './export-modal';
import { ThemeEngine } from '@mdreview/core';
import { setIconTheme } from './file-icons';
import type { IconThemeId } from './file-icons';

export class MDReviewElectronViewer {
  private tabManager: TabManager;
  private statusBar: StatusBar;
  private headerBar: DocumentHeaderBar;
  private fileTree: FileTree;
  private sidebarResize: SidebarResizeHandle | null = null;
  private preferencesPanel: PreferencesPanel;
  private exportModal: ExportModal;
  private themeEngine: ThemeEngine;
  private documents = new Map<string, DocumentContext>();
  private cleanupListeners: (() => void)[] = [];
  private openFolderPath: string | null = null;

  constructor() {
    this.tabManager = new TabManager();
    this.statusBar = new StatusBar();
    this.headerBar = new DocumentHeaderBar();
    this.fileTree = new FileTree();
    this.preferencesPanel = new PreferencesPanel();
    this.exportModal = new ExportModal();
    this.themeEngine = new ThemeEngine();
    this.exportModal.onExport((format) => {
      const ctx = this.getActiveDocumentContext();
      if (!ctx) return;
      if (format === 'pdf') {
        void ctx.exportPDF();
      } else {
        void ctx.exportDOCX();
      }
    });
  }

  async initialize(): Promise<void> {
    const tabBar = document.getElementById('mdreview-tab-bar');
    const contentArea = document.getElementById('mdreview-content-area');

    if (!tabBar || !contentArea) {
      console.error('[mdreview] No workspace elements found');
      return;
    }

    if (tabBar) {
      this.tabManager.render(tabBar);
    }
    if (contentArea) {
      this.tabManager.setContentArea(contentArea);
    }

    const statusBarEl = document.getElementById('mdreview-status-bar');
    if (statusBarEl) {
      this.statusBar.render(statusBarEl);
    }

    // Document header bar
    const headerBarEl = document.getElementById('mdreview-header-bar');
    if (headerBarEl) {
      this.headerBar.render(headerBarEl);
      this.headerBar.onExport((format) => {
        const ctx = this.getActiveDocumentContext();
        if (!ctx) return;
        if (format === 'pdf') {
          void ctx.exportPDF();
        } else {
          void ctx.exportDOCX();
        }
      });
      this.headerBar.onBreadcrumbClick((folderPath) => {
        void this.loadFolder(folderPath);
      });
    }

    // File tree sidebar
    const sidebarEl = document.getElementById('mdreview-sidebar');
    if (sidebarEl) {
      this.fileTree.render(sidebarEl);
      this.fileTree.onFileSelected((path) => {
        void this.openFile(path);
      });
      this.fileTree.onFileExport((path, format) => {
        void this.openFile(path).then(() => {
          const ctx = this.getActiveDocumentContext();
          if (!ctx) return;
          if (format === 'pdf') {
            void ctx.exportPDF();
          } else {
            void ctx.exportDOCX();
          }
        });
      });

      // Sidebar resize handle
      const workspaceEl = document.getElementById('mdreview-workspace');
      if (workspaceEl) {
        this.sidebarResize = new SidebarResizeHandle(sidebarEl);
        this.sidebarResize.onResize = (width) => {
          void window.mdreview.setSidebarWidth(width);
        };
        this.sidebarResize.render(workspaceEl);
        this.cleanupListeners.push(() => this.sidebarResize?.dispose());
      }
    }

    // Restore workspace state (sidebar width, visibility, tab groups)
    try {
      const workspaceState = await window.mdreview.getWorkspaceState();
      if (sidebarEl && workspaceState.sidebarWidth) {
        this.sidebarResize?.setSidebarWidth(workspaceState.sidebarWidth);
      }
      if (workspaceState.tabGroups?.length > 0) {
        this.tabManager.restoreGroups(workspaceState.tabGroups);
      }
      if (workspaceState.tabBarVisible === false) {
        tabBar.classList.add('hidden');
      }
      if (workspaceState.headerBarVisible === false && headerBarEl) {
        this.headerBar.setVisible(false);
      }
      if (workspaceState.statusBarVisible === false && statusBarEl) {
        statusBarEl.classList.add('hidden');
      }
      if (workspaceState.openFolderPath) {
        this.openFolderPath = workspaceState.openFolderPath;
      }
    } catch {
      // Workspace state restore is best-effort
    }

    // Wire tab callbacks
    this.tabManager.onTabClick((tabId) => {
      this.switchTab(tabId);
    });

    this.tabManager.onTabClose((tabId) => {
      void this.closeFile(tabId);
    });

    this.tabManager.onTabExport((tabId, format) => {
      const ctx = this.documents.get(tabId);
      if (!ctx) return;
      if (format === 'pdf') {
        void ctx.exportPDF();
      } else {
        void ctx.exportDOCX();
      }
    });

    // Sync tab groups to main process on any group mutation
    this.tabManager.onGroupChanged((groups) => {
      void this.syncGroups(groups);
    });

    // Keyboard shortcuts
    const cleanupShortcuts = registerKeyboardShortcuts({
      nextTab: () => this.cycleTab(1),
      prevTab: () => this.cycleTab(-1),
      switchToTab: (index) => this.switchToTabByIndex(index),
      openPreferences: () => void this.openPreferences(),
      openExportModal: () => this.showExportModal(),
      toggleTabBar: () => this.togglePanel('tab-bar'),
      toggleHeaderBar: () => this.togglePanel('header-bar'),
      toggleToc: () => {
        const ctx = this.getActiveDocumentContext();
        ctx?.toggleToc();
      },
    });
    this.cleanupListeners.push(cleanupShortcuts);

    // Drag and drop
    const workspace = document.getElementById('mdreview-workspace') ?? document.body;
    const cleanupDragDrop = setupDragAndDrop({
      target: workspace,
      onFilesDropped: (paths) => {
        for (const p of paths) {
          void this.openFile(p);
        }
      },
    });
    this.cleanupListeners.push(cleanupDragDrop);

    // Listen for IPC events from main process
    this.setupIPCListeners();

    // Initialize icon theme from saved preferences
    try {
      const initState = await window.mdreview.getState();
      setIconTheme((initState.preferences.iconTheme ?? 'lucide') as IconThemeId);
    } catch {
      // Best-effort
    }

    // Check for initial file from CLI args
    try {
      const filePath = await window.mdreview.getOpenFilePath();
      if (filePath) {
        await this.openFile(filePath);
      } else {
        this.showEmptyState();
      }
    } catch (error) {
      console.error('[mdreview] Initialization error:', error);
    }
  }

  async openFile(filePath: string): Promise<void> {
    // Check if already open
    for (const [tabId, ctx] of this.documents) {
      if (ctx.getFilePath() === filePath) {
        this.switchTab(tabId);
        return;
      }
    }

    // Open tab in main process state
    const tabState = await window.mdreview.openTab(filePath);

    // Create tab UI
    this.tabManager.createTab(tabState.id, filePath, tabState.title);
    this.headerBar.update(filePath, this.openFolderPath);
    const tabContainer = this.tabManager.getTabContainer(tabState.id);

    if (!tabContainer) {
      console.error('[mdreview] Failed to create tab container');
      return;
    }

    // Hide empty state
    this.hideEmptyState();

    // Create document context and load
    const ctx = new DocumentContext(tabState.id);
    ctx.setOnProgress((progress) => this.statusBar.showProgress(progress));
    this.documents.set(tabState.id, ctx);

    try {
      const metadata = await ctx.load(filePath, tabContainer);
      this.statusBar.hideProgress();
      await window.mdreview.updateTabMetadata(tabState.id, {
        renderState: metadata.renderState,
        wordCount: metadata.wordCount,
        headingCount: metadata.headingCount,
        diagramCount: metadata.diagramCount,
        codeBlockCount: metadata.codeBlockCount,
      });
      await window.mdreview.addRecentFile(filePath);
      this.updateStatusBar(ctx);
    } catch (error) {
      this.statusBar.hideProgress();
      console.error('[mdreview] Error loading file:', error);
      tabContainer.innerHTML = `<p style="padding: 2rem; color: red;">Error loading file: ${String(error)}</p>`;
    }
  }

  async closeFile(tabId: string): Promise<void> {
    const ctx = this.documents.get(tabId);
    if (ctx) {
      ctx.dispose();
      this.documents.delete(tabId);
    }

    this.tabManager.closeTab(tabId);
    await window.mdreview.closeTab(tabId);

    if (this.documents.size === 0) {
      this.showEmptyState();
      this.statusBar.clear();
      this.headerBar.update(null, this.openFolderPath);
    } else {
      // Update header bar for the newly active tab
      const activeCtx = this.getActiveDocumentContext();
      if (activeCtx) {
        this.headerBar.update(activeCtx.getFilePath(), this.openFolderPath);
      }
    }
  }

  switchTab(tabId: string): void {
    // Save scroll position of current tab
    const currentTabId = this.tabManager.getActiveTab();
    if (currentTabId) {
      const currentCtx = this.documents.get(currentTabId);
      const currentContainer = this.tabManager.getTabContainer(currentTabId);
      if (currentCtx && currentContainer) {
        currentCtx.setScrollPosition(currentContainer.scrollTop);
      }
    }

    this.tabManager.activateTab(tabId);
    void window.mdreview.setActiveTab(tabId);

    // Restore scroll position
    const ctx = this.documents.get(tabId);
    const container = this.tabManager.getTabContainer(tabId);
    if (ctx && container) {
      container.scrollTop = ctx.getScrollPosition();
    }

    // Update status bar and header bar for new active tab
    if (ctx) {
      this.updateStatusBar(ctx);
      this.headerBar.update(ctx.getFilePath(), this.openFolderPath);
    }
  }

  getTabCount(): number {
    return this.tabManager.getTabCount();
  }

  getActiveTabId(): string | null {
    return this.tabManager.getActiveTab();
  }

  getDocument(tabId: string): DocumentContext | undefined {
    return this.documents.get(tabId);
  }

  private togglePanel(panel: 'tab-bar' | 'header-bar' | 'status-bar'): void {
    const elId =
      panel === 'tab-bar'
        ? 'mdreview-tab-bar'
        : panel === 'header-bar'
          ? 'mdreview-header-bar'
          : 'mdreview-status-bar';

    const el = document.getElementById(elId);
    if (!el) return;

    const isHidden = el.classList.contains('hidden');
    if (isHidden) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }

    const visible = isHidden; // toggled
    if (panel === 'tab-bar') {
      void window.mdreview.setTabBarVisible(visible);
    } else if (panel === 'header-bar') {
      void window.mdreview.setHeaderBarVisible(visible);
    }
    // Status bar visibility isn't persisted separately yet
  }

  private cycleTab(direction: number): void {
    const tabIds = this.tabManager.getTabIds();
    if (tabIds.length <= 1) return;
    const currentIndex = tabIds.indexOf(this.tabManager.getActiveTab() ?? '');
    if (currentIndex === -1) return;
    const newIndex = (currentIndex + direction + tabIds.length) % tabIds.length;
    this.switchTab(tabIds[newIndex]);
  }

  private switchToTabByIndex(index: number): void {
    const tabIds = this.tabManager.getTabIds();
    if (index < tabIds.length) {
      this.switchTab(tabIds[index]);
    }
  }

  private getStatusBarData(ctx: DocumentContext) {
    const metadata = ctx.getMetadata();
    return {
      filePath: metadata.filePath,
      wordCount: metadata.wordCount,
      headingCount: metadata.headingCount,
      diagramCount: metadata.diagramCount,
      codeBlockCount: metadata.codeBlockCount,
      renderState: metadata.renderState,
    };
  }

  private updateStatusBar(ctx: DocumentContext): void {
    this.statusBar.update(this.getStatusBarData(ctx));
  }

  private getActiveDocumentContext(): DocumentContext | undefined {
    const activeTab = this.tabManager.getActiveTab();
    return activeTab ? this.documents.get(activeTab) : undefined;
  }

  private handleMenuCommand(command: string): void {
    if (command.startsWith('open:')) {
      void this.openFile(command.slice(5));
    } else if (command === 'close-tab') {
      const activeTab = this.tabManager.getActiveTab();
      if (activeTab) {
        void this.closeFile(activeTab);
      }
    } else if (command === 'toggle-sidebar') {
      const sidebarEl = document.getElementById('mdreview-sidebar');
      if (sidebarEl) {
        const isVisible = sidebarEl.style.display !== 'none';
        this.fileTree.setVisible(!isVisible);
        void window.mdreview.setSidebarVisible(!isVisible);
      }
    } else if (command === 'toggle-toc') {
      const ctx = this.getActiveDocumentContext();
      ctx?.toggleToc();
    } else if (command === 'toggle-tab-bar') {
      this.togglePanel('tab-bar');
    } else if (command === 'toggle-header-bar') {
      this.togglePanel('header-bar');
    } else if (command === 'toggle-status-bar') {
      this.togglePanel('status-bar');
    } else if (command === 'export:modal') {
      this.showExportModal();
    } else if (command === 'export:pdf') {
      const ctx = this.getActiveDocumentContext();
      if (ctx) {
        void ctx.exportPDF();
      }
    } else if (command === 'export:docx') {
      const ctx = this.getActiveDocumentContext();
      if (ctx) {
        void ctx.exportDOCX();
      }
    } else if (command === 'help:github') {
      void window.mdreview.openExternal('https://github.com/yaklabco/mdreview');
    } else if (command === 'preferences') {
      void this.openPreferences();
    }
  }

  private static readonly AVAILABLE_THEMES: Array<{
    name: string;
    displayName: string;
    variant: 'light' | 'dark';
  }> = [
    { name: 'github-light', displayName: 'GitHub Light', variant: 'light' },
    { name: 'github-dark', displayName: 'GitHub Dark', variant: 'dark' },
    { name: 'catppuccin-latte', displayName: 'Catppuccin Latte', variant: 'light' },
    { name: 'catppuccin-frappe', displayName: 'Catppuccin Frappé', variant: 'light' },
    { name: 'catppuccin-macchiato', displayName: 'Catppuccin Macchiato', variant: 'dark' },
    { name: 'catppuccin-mocha', displayName: 'Catppuccin Mocha', variant: 'dark' },
    { name: 'monokai', displayName: 'Monokai', variant: 'dark' },
    { name: 'monokai-pro', displayName: 'Monokai Pro', variant: 'dark' },
    { name: 'one-dark-pro', displayName: 'One Dark Pro', variant: 'dark' },
  ];

  private showExportModal(): void {
    const ctx = this.getActiveDocumentContext();
    if (!ctx) return;
    const filePath = ctx.getFilePath();
    const name = filePath.split('/').pop() ?? filePath;
    this.exportModal.show(name);
  }

  private async openPreferences(): Promise<void> {
    const state = await window.mdreview.getState();
    const p = state.preferences;

    this.preferencesPanel.show(
      {
        theme: p.theme || 'github-light',
        autoTheme: p.autoTheme ?? true,
        lightTheme: p.lightTheme || 'github-light',
        darkTheme: p.darkTheme || 'github-dark',
        autoReload: p.autoReload ?? true,
        showAllFiles: p.showAllFiles ?? false,
        iconTheme: p.iconTheme ?? 'lucide',
        lineNumbers: p.lineNumbers ?? false,
        enableHtml: p.enableHtml ?? false,
        fontFamily: p.fontFamily,
        codeFontFamily: p.codeFontFamily,
        lineHeight: p.lineHeight,
        useMaxWidth: p.useMaxWidth,
        maxWidth: p.maxWidth,
        showToc: p.showToc ?? false,
        tocPosition: p.tocPosition ?? 'left',
        tocMaxDepth: p.tocMaxDepth ?? 6,
        tocAutoCollapse: p.tocAutoCollapse ?? false,
        exportDefaultFormat: p.exportDefaultFormat,
        exportDefaultPageSize: p.exportDefaultPageSize,
        exportIncludeToc: p.exportIncludeToc,
        exportFilenameTemplate: p.exportFilenameTemplate,
      },
      MDReviewElectronViewer.AVAILABLE_THEMES
    );
  }

  private setupIPCListeners(): void {
    const unsubOpenFile = window.mdreview.onOpenFile((path: string) => {
      void this.openFile(path);
    });
    this.cleanupListeners.push(unsubOpenFile);

    const unsubMenuCommand = window.mdreview.onMenuCommand((command: string) => {
      this.handleMenuCommand(command);
    });
    this.cleanupListeners.push(unsubMenuCommand);

    const unsubOpenFolder = window.mdreview.onOpenFolder((folderPath: string) => {
      void this.loadFolder(folderPath);
    });
    this.cleanupListeners.push(unsubOpenFolder);

    const unsubPrefs = window.mdreview.onPreferencesUpdated((prefs) => {
      for (const ctx of this.documents.values()) {
        void ctx.applyPreferences(prefs);
      }
      const activeTab = this.tabManager.getActiveTab();
      if (activeTab) {
        const activeCtx = this.documents.get(activeTab);
        if (activeCtx) {
          this.updateStatusBar(activeCtx);
        }
      }
      // Update icon theme and rerender file tree
      if ('iconTheme' in prefs) {
        setIconTheme((prefs.iconTheme as IconThemeId) ?? 'lucide');
        this.fileTree.rerender();
      }
      // Re-scan folder when showAllFiles preference changes
      if ('showAllFiles' in prefs && this.openFolderPath) {
        void this.loadFolder(this.openFolderPath);
      }
    });
    this.cleanupListeners.push(unsubPrefs);

    const unsubTheme = window.mdreview.onThemeChanged((theme: string) => {
      // Always apply theme to app chrome (CSS variables on :root)
      void this.themeEngine.applyTheme(theme);
      for (const ctx of this.documents.values()) {
        void ctx.applyTheme(theme);
      }
      const activeTab = this.tabManager.getActiveTab();
      if (activeTab) {
        const activeCtx = this.documents.get(activeTab);
        if (activeCtx) {
          this.statusBar.update({
            ...this.getStatusBarData(activeCtx),
            themeName: theme,
          });
        }
      }
    });
    this.cleanupListeners.push(unsubTheme);

    window.addEventListener('beforeunload', () => {
      this.dispose();
    });
  }

  private showEmptyState(): void {
    const contentArea = document.getElementById('mdreview-content-area');
    if (!contentArea) return;

    let emptyState = document.getElementById('mdreview-empty-state');
    if (!emptyState) {
      emptyState = document.createElement('div');
      emptyState.id = 'mdreview-empty-state';
      emptyState.innerHTML = `
        <div class="empty-state-content">
          <h2>Design Review</h2>
          <p>Open a file to get started</p>
          <div class="empty-state-actions">
            <button id="empty-open-file" class="empty-state-btn">Open File</button>
            <button id="empty-open-folder" class="empty-state-btn">Open Folder</button>
          </div>
        </div>
      `;
      contentArea.appendChild(emptyState);

      document.getElementById('empty-open-file')?.addEventListener('click', () => {
        void this.handleOpenFileDialog();
      });
      document.getElementById('empty-open-folder')?.addEventListener('click', () => {
        void this.handleOpenFolderDialog();
      });
    }

    emptyState.style.display = '';
  }

  private hideEmptyState(): void {
    const emptyState = document.getElementById('mdreview-empty-state');
    if (emptyState) {
      emptyState.style.display = 'none';
    }
  }

  private async handleOpenFileDialog(): Promise<void> {
    const paths = await window.mdreview.showOpenFileDialog();
    if (paths) {
      for (const p of paths) {
        await this.openFile(p);
      }
    }
  }

  private async handleOpenFolderDialog(): Promise<void> {
    const folderPath = await window.mdreview.showOpenFolderDialog();
    if (folderPath) {
      await this.loadFolder(folderPath);
    }
  }

  private async syncGroups(
    groups: import('../shared/workspace-types').TabGroupState[]
  ): Promise<void> {
    try {
      // Get current persisted groups
      const ws = await window.mdreview.getWorkspaceState();
      const existingIds = new Set(ws.tabGroups.map((g) => g.id));
      const newIds = new Set(groups.map((g) => g.id));

      // Delete removed groups
      for (const id of existingIds) {
        if (!newIds.has(id)) {
          await window.mdreview.deleteTabGroup(id);
        }
      }

      // Create or update groups
      for (const group of groups) {
        if (existingIds.has(group.id)) {
          await window.mdreview.updateTabGroup(group.id, {
            name: group.name,
            color: group.color,
            collapsed: group.collapsed,
            tabIds: group.tabIds,
          });
        } else {
          await window.mdreview.createTabGroup(group.name, group.color, group.tabIds);
        }
      }
    } catch (error) {
      console.error('[mdreview] Error syncing groups:', error);
    }
  }

  private async loadFolder(folderPath: string): Promise<void> {
    this.openFolderPath = folderPath;
    await window.mdreview.setOpenFolder(folderPath);
    const state = await window.mdreview.getState();
    const showAllFiles = state.preferences.showAllFiles ?? false;
    const entries = await window.mdreview.listDirectory(folderPath, { showAllFiles });
    this.fileTree.setRootPath(folderPath);
    this.fileTree.loadDirectory(entries);
    this.fileTree.setVisible(true);

    // Update header bar breadcrumb with new folder context
    const activeCtx = this.getActiveDocumentContext();
    if (activeCtx) {
      this.headerBar.update(activeCtx.getFilePath(), this.openFolderPath);
    }
  }

  private dispose(): void {
    for (const ctx of this.documents.values()) {
      ctx.dispose();
    }
    this.documents.clear();
    for (const cleanup of this.cleanupListeners) {
      cleanup();
    }
    this.cleanupListeners = [];
    this.tabManager.dispose();
    this.headerBar.dispose();
    this.fileTree.dispose();
    this.preferencesPanel.dispose();
    this.exportModal.dispose();
  }
}

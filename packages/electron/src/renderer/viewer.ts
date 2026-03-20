/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

import { TabManager } from './tab-manager';
import { DocumentContext } from './document-context';
import { StatusBar } from './status-bar';
import { registerKeyboardShortcuts } from './keyboard-shortcuts';
import { setupDragAndDrop } from './drag-drop';
import { FileTree } from './file-tree';
import { SidebarResizeHandle } from './sidebar-resize';

export class MDViewElectronViewer {
  private tabManager: TabManager;
  private statusBar: StatusBar;
  private fileTree: FileTree;
  private sidebarResize: SidebarResizeHandle | null = null;
  private documents = new Map<string, DocumentContext>();
  private cleanupListeners: (() => void)[] = [];

  constructor() {
    this.tabManager = new TabManager();
    this.statusBar = new StatusBar();
    this.fileTree = new FileTree();
  }

  async initialize(): Promise<void> {
    const tabBar = document.getElementById('mdview-tab-bar');
    const contentArea = document.getElementById('mdview-content-area');
    const container = document.getElementById('mdview-container');

    if (!tabBar || !contentArea) {
      // Fallback: legacy single-container mode
      if (!container) {
        console.error('[mdview] No workspace elements found');
        return;
      }
    }

    if (tabBar) {
      this.tabManager.render(tabBar);
    }
    if (contentArea) {
      this.tabManager.setContentArea(contentArea);
    }

    const statusBarEl = document.getElementById('mdview-status-bar');
    if (statusBarEl) {
      this.statusBar.render(statusBarEl);
    }

    // File tree sidebar
    const sidebarEl = document.getElementById('mdview-sidebar');
    if (sidebarEl) {
      this.fileTree.render(sidebarEl);
      this.fileTree.onFileSelected((path) => {
        void this.openFile(path);
      });

      // Sidebar resize handle
      const workspaceEl = document.getElementById('mdview-workspace');
      if (workspaceEl) {
        this.sidebarResize = new SidebarResizeHandle(sidebarEl);
        this.sidebarResize.onResize = (width) => {
          void window.mdview.setSidebarWidth(width);
        };
        this.sidebarResize.render(workspaceEl);
        this.cleanupListeners.push(() => this.sidebarResize?.dispose());
      }
    }

    // Restore workspace state (sidebar width)
    try {
      const workspaceState = await window.mdview.getWorkspaceState();
      if (sidebarEl && workspaceState.sidebarWidth) {
        this.sidebarResize?.setSidebarWidth(workspaceState.sidebarWidth);
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

    // Keyboard shortcuts
    const cleanupShortcuts = registerKeyboardShortcuts({
      nextTab: () => this.cycleTab(1),
      prevTab: () => this.cycleTab(-1),
      switchToTab: (index) => this.switchToTabByIndex(index),
    });
    this.cleanupListeners.push(cleanupShortcuts);

    // Drag and drop
    const workspace = document.getElementById('mdview-workspace') ?? document.body;
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

    // Check for initial file from CLI args
    try {
      const filePath = await window.mdview.getOpenFilePath();
      if (filePath) {
        await this.openFile(filePath);
      } else {
        this.showEmptyState();
      }
    } catch (error) {
      console.error('[mdview] Initialization error:', error);
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
    const tabState = await window.mdview.openTab(filePath);

    // Create tab UI
    this.tabManager.createTab(tabState.id, filePath, tabState.title);
    const tabContainer = this.tabManager.getTabContainer(tabState.id);

    if (!tabContainer) {
      console.error('[mdview] Failed to create tab container');
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
      await window.mdview.updateTabMetadata(tabState.id, {
        renderState: metadata.renderState,
        wordCount: metadata.wordCount,
        headingCount: metadata.headingCount,
        diagramCount: metadata.diagramCount,
        codeBlockCount: metadata.codeBlockCount,
      });
      await window.mdview.addRecentFile(filePath);
      this.updateStatusBar(ctx);
    } catch (error) {
      this.statusBar.hideProgress();
      console.error('[mdview] Error loading file:', error);
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
    await window.mdview.closeTab(tabId);

    if (this.documents.size === 0) {
      this.showEmptyState();
      this.statusBar.clear();
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
    void window.mdview.setActiveTab(tabId);

    // Restore scroll position
    const ctx = this.documents.get(tabId);
    const container = this.tabManager.getTabContainer(tabId);
    if (ctx && container) {
      container.scrollTop = ctx.getScrollPosition();
    }

    // Update status bar for new active tab
    if (ctx) {
      this.updateStatusBar(ctx);
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
      const sidebarEl = document.getElementById('mdview-sidebar');
      if (sidebarEl) {
        const isVisible = sidebarEl.style.display !== 'none';
        this.fileTree.setVisible(!isVisible);
        void window.mdview.setSidebarVisible(!isVisible);
      }
    } else if (command === 'toggle-toc') {
      const ctx = this.getActiveDocumentContext();
      ctx?.toggleToc();
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
    } else if (command === 'help:about') {
      this.showAboutModal();
    } else if (command === 'help:github') {
      void window.mdview.openExternal('https://github.com/jamesainslie/mdview');
    }
  }

  private showAboutModal(): void {
    // Don't create duplicate modals
    if (document.querySelector('.mdview-about-modal')) return;

    const modal = document.createElement('div');
    modal.className = 'mdview-about-modal';
    modal.innerHTML = `
      <div class="mdview-about-card">
        <h2>mdview</h2>
        <p>Markdown Viewer</p>
        <p>Version 0.3.4</p>
      </div>
    `;

    const dismiss = () => modal.remove();
    modal.addEventListener('click', dismiss);

    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss();
        document.removeEventListener('keydown', onEscape);
      }
    };
    document.addEventListener('keydown', onEscape);

    document.body.appendChild(modal);
  }

  private setupIPCListeners(): void {
    const unsubOpenFile = window.mdview.onOpenFile((path: string) => {
      void this.openFile(path);
    });
    this.cleanupListeners.push(unsubOpenFile);

    const unsubMenuCommand = window.mdview.onMenuCommand((command: string) => {
      this.handleMenuCommand(command);
    });
    this.cleanupListeners.push(unsubMenuCommand);

    const unsubOpenFolder = window.mdview.onOpenFolder((folderPath: string) => {
      void this.loadFolder(folderPath);
    });
    this.cleanupListeners.push(unsubOpenFolder);

    const unsubPrefs = window.mdview.onPreferencesUpdated((prefs) => {
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
    });
    this.cleanupListeners.push(unsubPrefs);

    const unsubTheme = window.mdview.onThemeChanged((theme: string) => {
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
    const contentArea = document.getElementById('mdview-content-area');
    if (!contentArea) return;

    let emptyState = document.getElementById('mdview-empty-state');
    if (!emptyState) {
      emptyState = document.createElement('div');
      emptyState.id = 'mdview-empty-state';
      emptyState.innerHTML = `
        <div class="empty-state-content">
          <h2>mdview</h2>
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
    const emptyState = document.getElementById('mdview-empty-state');
    if (emptyState) {
      emptyState.style.display = 'none';
    }
  }

  private async handleOpenFileDialog(): Promise<void> {
    const paths = await window.mdview.showOpenFileDialog();
    if (paths) {
      for (const p of paths) {
        await this.openFile(p);
      }
    }
  }

  private async handleOpenFolderDialog(): Promise<void> {
    const folderPath = await window.mdview.showOpenFolderDialog();
    if (folderPath) {
      await this.loadFolder(folderPath);
    }
  }

  private async loadFolder(folderPath: string): Promise<void> {
    await window.mdview.setOpenFolder(folderPath);
    const entries = await window.mdview.listDirectory(folderPath);
    this.fileTree.loadDirectory(entries);
    this.fileTree.setVisible(true);
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
    this.fileTree.dispose();
  }
}

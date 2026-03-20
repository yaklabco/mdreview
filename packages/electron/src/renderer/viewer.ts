/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

import { TabManager } from './tab-manager';
import { DocumentContext } from './document-context';

export class MDViewElectronViewer {
  private tabManager: TabManager;
  private documents = new Map<string, DocumentContext>();
  private cleanupListeners: (() => void)[] = [];

  constructor() {
    this.tabManager = new TabManager();
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

    // Wire tab callbacks
    this.tabManager.onTabClick((tabId) => {
      this.switchTab(tabId);
    });

    this.tabManager.onTabClose((tabId) => {
      void this.closeFile(tabId);
    });

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
    this.documents.set(tabState.id, ctx);

    try {
      const metadata = await ctx.load(filePath, tabContainer);
      await window.mdview.updateTabMetadata(tabState.id, {
        renderState: metadata.renderState,
        wordCount: metadata.wordCount,
        headingCount: metadata.headingCount,
        diagramCount: metadata.diagramCount,
        codeBlockCount: metadata.codeBlockCount,
      });
      await window.mdview.addRecentFile(filePath);
    } catch (error) {
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

  private setupIPCListeners(): void {
    const unsubOpenFile = window.mdview.onOpenFile((path: string) => {
      void this.openFile(path);
    });
    this.cleanupListeners.push(unsubOpenFile);

    const unsubMenuCommand = window.mdview.onMenuCommand((command: string) => {
      if (command.startsWith('open:')) {
        void this.openFile(command.slice(5));
      } else if (command === 'close-tab') {
        const activeTab = this.tabManager.getActiveTab();
        if (activeTab) {
          void this.closeFile(activeTab);
        }
      }
    });
    this.cleanupListeners.push(unsubMenuCommand);

    const unsubPrefs = window.mdview.onPreferencesUpdated(() => {
      // Preferences changes could trigger re-renders
    });
    this.cleanupListeners.push(unsubPrefs);

    const unsubTheme = window.mdview.onThemeChanged(() => {
      // Theme changes could trigger re-applies
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
      await window.mdview.setOpenFolder(folderPath);
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
  }
}

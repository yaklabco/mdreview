/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

import {
  RenderPipeline,
  ThemeEngine,
  TocRenderer,
  ExportUI,
  CommentManager,
  FileScanner,
  type AppState,
  type RenderProgress,
  type Preferences,
} from '@mdview/core';
import {
  ElectronMessagingAdapter,
  ElectronRendererStorageAdapter,
  ElectronRendererFileAdapter,
  ElectronRendererIdentityAdapter,
  ElectronRendererExportAdapter,
} from './adapters';

export class MDViewElectronViewer {
  private state: AppState | null = null;
  private renderPipeline: RenderPipeline;
  private themeEngine: ThemeEngine;
  private fileAdapter: ElectronRendererFileAdapter;
  private identityAdapter: ElectronRendererIdentityAdapter;
  private exportAdapter: ElectronRendererExportAdapter;
  private tocRenderer: TocRenderer | null = null;
  private exportUI: ExportUI | null = null;
  private commentManager: CommentManager | null = null;
  private autoReloadCleanup: (() => void) | null = null;
  private cleanupListeners: (() => void)[] = [];

  constructor() {
    const messaging = new ElectronMessagingAdapter();
    const storage = new ElectronRendererStorageAdapter();
    this.fileAdapter = new ElectronRendererFileAdapter();
    this.identityAdapter = new ElectronRendererIdentityAdapter();
    this.exportAdapter = new ElectronRendererExportAdapter();

    this.renderPipeline = new RenderPipeline({ messaging });
    this.themeEngine = new ThemeEngine(storage);
  }

  async initialize(): Promise<void> {
    const container = document.getElementById('mdview-container');
    if (!container) {
      console.error('[mdview] No #mdview-container found');
      return;
    }

    try {
      // 1. Get file path from main process
      const filePath = await window.mdview.getOpenFilePath();
      if (!filePath) {
        container.innerHTML =
          '<p style="padding: 2rem; color: #666;">No file specified. Drag a .md file onto the window or open one from the command line.</p>';
        return;
      }

      // 2. Load state/preferences
      this.state = await window.mdview.getState();

      // 3. Read file
      const content = await window.mdview.readFile(filePath);
      const fileSize = FileScanner.getFileSize(content);

      // 4. Create loading UI
      const loadingDiv = this.createLoadingOverlay();
      const progressIndicator = this.createProgressIndicator();
      document.body.appendChild(loadingDiv);
      document.body.appendChild(progressIndicator);

      // Activate body class for CSS scoping
      document.body.classList.add('mdview-active');

      // 5. Apply theme
      const theme = this.state.preferences.theme || 'github-light';
      await this.themeEngine.applyTheme(theme);

      // 6. Set up progress callback
      const cleanupProgress = this.renderPipeline.onProgress((progress: RenderProgress) => {
        this.updateProgress(progressIndicator, loadingDiv, progress);
      });

      // 7. Render
      await this.renderPipeline.render({
        container,
        markdown: content,
        progressive: fileSize > 500000,
        filePath,
        theme,
        preferences: this.state.preferences,
        useCache: true,
        useWorkers: false, // Workers not available in Electron renderer with contextIsolation
      });

      cleanupProgress();
      loadingDiv.remove();

      // 8. Post-render: TOC
      if (this.state.preferences.showToc) {
        const headings = this.extractHeadings(container);
        if (headings.length > 0) {
          this.tocRenderer = new TocRenderer(headings, {
            maxDepth: this.state.preferences.tocMaxDepth ?? 6,
            autoCollapse: this.state.preferences.tocAutoCollapse ?? false,
            position: this.state.preferences.tocPosition ?? 'left',
            style: this.state.preferences.tocStyle ?? 'floating',
          });
          this.tocRenderer.render(container);
        }
      }

      // 9. Post-render: Export UI
      this.exportUI = new ExportUI({
        messaging: new ElectronMessagingAdapter(),
      });
      this.exportUI.render(container);

      // 10. Post-render: Comments
      if (this.state.preferences.commentsEnabled !== false) {
        this.commentManager = new CommentManager({
          file: this.fileAdapter,
          identity: this.identityAdapter,
        });
        await this.commentManager.initialize(content, filePath, container);
      }

      // 11. Auto-reload
      if (this.state.preferences.autoReload) {
        this.setupAutoReload(filePath, container, content);
      }

      // 12. Listen for preference/theme updates from main
      this.setupEventListeners(container, filePath);
    } catch (error) {
      console.error('[mdview] Initialization error:', error);
      container.innerHTML = `<p style="padding: 2rem; color: red;">Error loading file: ${String(error)}</p>`;
    }
  }

  private createLoadingOverlay(): HTMLElement {
    const div = document.createElement('div');
    div.id = 'mdview-loading-overlay';
    div.className = 'mdview-loading';
    div.textContent = 'Rendering markdown...';
    return div;
  }

  private createProgressIndicator(): HTMLElement {
    const div = document.createElement('div');
    div.id = 'mdview-progress-indicator';
    div.innerHTML = `
      <div class="progress-text">Rendering... 0%</div>
      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width: 0%"></div>
      </div>
    `;
    return div;
  }

  private updateProgress(
    indicator: HTMLElement,
    loadingDiv: HTMLElement,
    progress: RenderProgress
  ): void {
    const pct = Math.round(progress.progress);
    const text = indicator.querySelector('.progress-text');
    const bar = indicator.querySelector('.progress-bar-fill');

    if (text) text.textContent = `${pct}%`;
    if (bar) bar.style.width = `${pct}%`;

    if (progress.progress > 5 && loadingDiv.style.display !== 'none') {
      loadingDiv.style.display = 'none';
    }

    if (progress.progress >= 100) {
      indicator.classList.add('complete');
      setTimeout(() => indicator.remove(), 1000);
    }
  }

  private extractHeadings(container: HTMLElement): { level: number; text: string; id: string }[] {
    const headings: { level: number; text: string; id: string }[] = [];
    container.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
      const level = parseInt(el.tagName.charAt(1), 10);
      headings.push({
        level,
        text: el.textContent || '',
        id: el.id || '',
      });
    });
    return headings;
  }

  private setupAutoReload(filePath: string, container: HTMLElement, initialContent: string): void {
    let lastContent = initialContent;
    let reloadTimeout: ReturnType<typeof setTimeout> | null = null;

    const unwatch = this.fileAdapter.watch(filePath, () => {
      if (reloadTimeout) clearTimeout(reloadTimeout);
      reloadTimeout = setTimeout(() => {
        void (async () => {
          try {
            const newContent = await this.fileAdapter.readFile(filePath);
            if (newContent !== lastContent) {
              lastContent = newContent;
              await this.renderPipeline.render({
                container,
                markdown: newContent,
                progressive: false,
                filePath,
                theme: this.state?.preferences.theme || 'github-light',
                preferences: this.state?.preferences || ({} as Preferences),
                useCache: true,
                useWorkers: false,
              });
            }
          } catch (err) {
            console.error('[mdview] Auto-reload error:', err);
          }
        })();
      }, 500);
    });

    this.autoReloadCleanup = unwatch;
  }

  private setupEventListeners(_container: HTMLElement, filePath: string): void {
    const unsubPrefs = window.mdview.onPreferencesUpdated((prefs) => {
      if (!this.state) return;
      Object.assign(this.state.preferences, prefs);

      if ('theme' in prefs) {
        void this.themeEngine.applyTheme(this.state.preferences.theme);
      }
    });
    this.cleanupListeners.push(unsubPrefs);

    const unsubTheme = window.mdview.onThemeChanged((theme) => {
      void this.themeEngine.applyTheme(theme as AppState['preferences']['theme']);
    });
    this.cleanupListeners.push(unsubTheme);

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      this.dispose(filePath);
    });
  }

  private dispose(filePath: string): void {
    if (this.autoReloadCleanup) {
      this.autoReloadCleanup();
      this.autoReloadCleanup = null;
    }
    for (const cleanup of this.cleanupListeners) {
      cleanup();
    }
    this.cleanupListeners = [];
    void window.mdview.unwatchFile(filePath);
  }
}

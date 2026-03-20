/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

import {
  RenderPipeline,
  ThemeEngine,
  TocRenderer,
  ExportUI,
  CommentManager,
  FileScanner,
  ContentCollector,
  SVGConverter,
  DOCXGenerator,
  type Preferences,
  type RenderProgress,
} from '@mdview/core';
import {
  ElectronMessagingAdapter,
  ElectronRendererStorageAdapter,
  ElectronRendererFileAdapter,
  ElectronRendererIdentityAdapter,
} from './adapters';

export interface DocumentMetadata {
  filePath: string;
  title: string;
  wordCount: number;
  headingCount: number;
  diagramCount: number;
  codeBlockCount: number;
  renderState: 'pending' | 'rendering' | 'complete' | 'error';
}

export class DocumentContext {
  private filePath: string | null = null;
  private container: HTMLElement | null = null;
  private scrollPosition = 0;
  private renderPipeline: RenderPipeline;
  private themeEngine: ThemeEngine;
  private fileAdapter: ElectronRendererFileAdapter;
  private identityAdapter: ElectronRendererIdentityAdapter;
  private tocRenderer: TocRenderer | null = null;
  private exportUI: ExportUI | null = null;
  private commentManager: CommentManager | null = null;
  private autoReloadCleanup: (() => void) | null = null;
  private onProgressCallback: ((progress: { stage: string; percent: number }) => void) | null = null;
  private metadata: DocumentMetadata = {
    filePath: '',
    title: '',
    wordCount: 0,
    headingCount: 0,
    diagramCount: 0,
    codeBlockCount: 0,
    renderState: 'pending',
  };

  constructor(private tabId: string) {
    const messaging = new ElectronMessagingAdapter();
    const storage = new ElectronRendererStorageAdapter();
    this.fileAdapter = new ElectronRendererFileAdapter();
    this.identityAdapter = new ElectronRendererIdentityAdapter();
    this.renderPipeline = new RenderPipeline({ messaging });
    this.themeEngine = new ThemeEngine(storage);
  }

  async load(filePath: string, container: HTMLElement): Promise<DocumentMetadata> {
    this.filePath = filePath;
    this.container = container;
    this.metadata.filePath = filePath;
    this.metadata.title = filePath.split('/').pop() ?? filePath;
    this.metadata.renderState = 'rendering';

    const state = await window.mdview.getState();
    const content = await window.mdview.readFile(filePath);
    const fileSize = FileScanner.getFileSize(content);
    const theme = state.preferences.theme || 'github-light';

    document.body.classList.add('mdview-active');
    await this.themeEngine.applyTheme(theme);

    const cleanupProgress = this.renderPipeline.onProgress((progress: RenderProgress) => {
      if (this.onProgressCallback) {
        this.onProgressCallback({ stage: progress.stage, percent: progress.percent });
      }
    });

    await this.renderPipeline.render({
      container,
      markdown: content,
      progressive: fileSize > 500000,
      filePath,
      theme,
      preferences: state.preferences,
      useCache: true,
      useWorkers: false,
    });

    cleanupProgress();

    // Post-render: TOC
    if (state.preferences.showToc) {
      const headings = this.extractHeadings(container);
      if (headings.length > 0) {
        this.tocRenderer = new TocRenderer(headings, {
          maxDepth: state.preferences.tocMaxDepth ?? 6,
          autoCollapse: state.preferences.tocAutoCollapse ?? false,
          position: state.preferences.tocPosition ?? 'left',
          style: state.preferences.tocStyle ?? 'floating',
        });
        this.tocRenderer.render(container);
      }
    }

    // Post-render: Export UI
    this.exportUI = new ExportUI({ messaging: new ElectronMessagingAdapter() });
    this.exportUI.render(container);

    // Post-render: Comments
    if (state.preferences.commentsEnabled !== false) {
      this.commentManager = new CommentManager({
        file: this.fileAdapter,
        identity: this.identityAdapter,
      });
      await this.commentManager.initialize(content, filePath, container);
    }

    // Auto-reload
    if (state.preferences.autoReload) {
      this.setupAutoReload(filePath, container, content, state.preferences);
    }

    // Compute metadata
    this.updateMetadata(container, content);
    this.metadata.renderState = 'complete';

    return { ...this.metadata };
  }

  async reload(): Promise<DocumentMetadata | null> {
    if (!this.filePath || !this.container) return null;

    const state = await window.mdview.getState();
    const content = await window.mdview.readFile(this.filePath);

    await this.renderPipeline.render({
      container: this.container,
      markdown: content,
      progressive: false,
      filePath: this.filePath,
      theme: state.preferences.theme || 'github-light',
      preferences: state.preferences,
      useCache: true,
      useWorkers: false,
    });

    this.updateMetadata(this.container, content);
    return { ...this.metadata };
  }

  getMetadata(): DocumentMetadata {
    return { ...this.metadata };
  }

  getFilePath(): string | null {
    return this.filePath;
  }

  getTabId(): string {
    return this.tabId;
  }

  getScrollPosition(): number {
    return this.scrollPosition;
  }

  setScrollPosition(pos: number): void {
    this.scrollPosition = pos;
  }

  setOnProgress(callback: ((progress: { stage: string; percent: number }) => void) | null): void {
    this.onProgressCallback = callback;
  }

  toggleToc(): void {
    if (!this.container) return;

    if (this.tocRenderer) {
      this.tocRenderer.toggle();
    } else {
      const headings = this.extractHeadings(this.container);
      if (headings.length > 0) {
        this.tocRenderer = new TocRenderer(headings, {
          maxDepth: 6,
          autoCollapse: false,
          position: 'left',
          style: 'floating',
        });
        this.tocRenderer.render(this.container);
        this.tocRenderer.show();
      }
    }
  }

  async exportPDF(): Promise<void> {
    if (!this.filePath) return;
    const data = await window.mdview.printToPDF();
    const filename = (this.filePath.split('/').pop() ?? 'document').replace(/\.[^.]+$/, '') + '.pdf';
    await window.mdview.saveFile({ filename, mimeType: 'application/pdf', data });
  }

  async exportDOCX(): Promise<void> {
    if (!this.filePath || !this.container) return;
    const collector = new ContentCollector();
    const content = collector.collect(this.container);
    const svgElements = Array.from(this.container.querySelectorAll('svg')) as SVGElement[];
    const converter = new SVGConverter();
    const images = converter.convertAll(svgElements);
    const generator = new DOCXGenerator();
    const blob = await generator.generate(content, images);
    const arrayBuffer = await blob.arrayBuffer();
    const filename = (this.filePath.split('/').pop() ?? 'document').replace(/\.[^.]+$/, '') + '.docx';
    await window.mdview.saveFile({
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      data: arrayBuffer,
    });
  }

  async applyTheme(theme: string): Promise<void> {
    await this.themeEngine.applyTheme(theme);
  }

  async applyPreferences(prefs: Partial<Preferences>): Promise<void> {
    if (prefs.theme) {
      await this.applyTheme(prefs.theme);
    }
    if (prefs.showToc !== undefined) {
      if (prefs.showToc) {
        if (!this.tocRenderer && this.container) {
          this.toggleToc();
        }
      } else if (this.tocRenderer) {
        this.tocRenderer.hide();
      }
    }
  }

  getThemeEngine(): ThemeEngine {
    return this.themeEngine;
  }

  dispose(): void {
    if (this.autoReloadCleanup) {
      this.autoReloadCleanup();
      this.autoReloadCleanup = null;
    }
    if (this.filePath) {
      void window.mdview.unwatchFile(this.filePath);
    }
  }

  private updateMetadata(container: HTMLElement, content: string): void {
    const text = container.textContent ?? '';
    this.metadata.wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
    this.metadata.headingCount = container.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
    this.metadata.diagramCount = container.querySelectorAll('.mermaid').length;
    this.metadata.codeBlockCount = container.querySelectorAll('pre code').length;
    // Preserve filePath and title from content
    void content;
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

  private setupAutoReload(
    filePath: string,
    container: HTMLElement,
    initialContent: string,
    preferences: Preferences
  ): void {
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
                theme: preferences.theme || 'github-light',
                preferences,
                useCache: true,
                useWorkers: false,
              });
              this.updateMetadata(container, newContent);
            }
          } catch (err) {
            console.error('[mdview] Auto-reload error:', err);
          }
        })();
      }, 500);
    });

    this.autoReloadCleanup = unwatch;
  }
}

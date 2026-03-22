/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

import {
  RenderPipeline,
  ThemeEngine,
  TocRenderer,
  CommentManager,
  FileScanner,
  ContentCollector,
  SVGConverter,
  DOCXGenerator,
  type Preferences,
  type RenderProgress,
} from '@mdreview/core';
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
  private commentManager: CommentManager | null = null;
  private autoReloadCleanup: (() => void) | null = null;
  private onProgressCallback: ((progress: { stage: string; percent: number }) => void) | null =
    null;
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

    const state = await window.mdreview.getState();
    const content = await window.mdreview.readFile(filePath);
    const fileSize = FileScanner.getFileSize(content);
    const theme = state.preferences.theme || 'github-light';

    document.body.classList.add('mdreview-active');
    await this.themeEngine.applyTheme(theme);

    const cleanupProgress = this.renderPipeline.onProgress((progress: RenderProgress) => {
      if (this.onProgressCallback) {
        this.onProgressCallback({ stage: progress.stage, percent: progress.progress });
      }
    });

    // Build TOC the instant HTML lands in the DOM, before syntax highlighting
    // and mermaid rendering block the main thread. MutationObserver fires as a
    // microtask — ahead of the throttled progress callbacks and dynamic imports.
    let tocObserver: MutationObserver | null = null;
    if (state.preferences.showToc) {
      tocObserver = new MutationObserver(() => {
        if (!this.tocRenderer && container.querySelector('h1, h2, h3, h4, h5, h6')) {
          this.setupToc(container, state.preferences);
          tocObserver?.disconnect();
          tocObserver = null;
        }
      });
      tocObserver.observe(container, { childList: true });
    }

    // Rewrite relative URLs in the markdown source to local-asset:// absolute paths.
    // This ensures images and links resolve correctly from the start, rather than
    // relying solely on post-render DOM rewriting.
    const resolvedContent = DocumentContext.resolveContentUrls(content, filePath);

    await this.renderPipeline.render({
      container,
      markdown: resolvedContent,
      progressive: fileSize > 500000,
      filePath,
      theme,
      preferences: state.preferences,
      useCache: true,
      useWorkers: false,
    });

    cleanupProgress();
    tocObserver?.disconnect();

    // Fallback: if MutationObserver didn't fire (cached render or test environment)
    if (state.preferences.showToc && !this.tocRenderer) {
      this.setupToc(container, state.preferences);
    }

    // Export UI is handled by the header bar — no in-content export button needed

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

    // Resolve relative URLs to local-asset:// protocol
    this.resolveRelativeUrls(container, filePath);

    // Compute metadata
    this.updateMetadata(container, content);
    this.metadata.renderState = 'complete';

    return { ...this.metadata };
  }

  async reload(): Promise<DocumentMetadata | null> {
    if (!this.filePath || !this.container) return null;

    const state = await window.mdreview.getState();
    const content = await window.mdreview.readFile(this.filePath);

    const resolvedContent = DocumentContext.resolveContentUrls(content, this.filePath);

    await this.renderPipeline.render({
      container: this.container,
      markdown: resolvedContent,
      progressive: false,
      filePath: this.filePath,
      theme: state.preferences.theme || 'github-light',
      preferences: state.preferences,
      useCache: true,
      useWorkers: false,
    });

    this.resolveRelativeUrls(this.container, this.filePath);
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
      this.setupToc(this.container, {
        tocPosition: 'left',
        tocMaxDepth: 6,
        tocAutoCollapse: false,
      });
    }
  }

  private setupToc(
    container: HTMLElement,
    prefs: { tocPosition?: string; tocMaxDepth?: number; tocAutoCollapse?: boolean }
  ): void {
    const headings = this.extractHeadings(container);
    if (headings.length === 0) return;

    const position = (prefs.tocPosition as 'left' | 'right') ?? 'left';
    this.tocRenderer = new TocRenderer({
      maxDepth: prefs.tocMaxDepth ?? 6,
      autoCollapse: prefs.tocAutoCollapse ?? false,
      position,
      scrollContainer: container,
    });
    const tocEl = this.tocRenderer.render(headings);
    const wrapper = container.parentElement;
    if (wrapper) {
      wrapper.insertBefore(tocEl, container);
      if (position === 'right') {
        wrapper.classList.add('toc-position-right');
      }
    }
    this.tocRenderer.show();
  }

  async exportPDF(): Promise<void> {
    if (!this.filePath) return;
    const data = await window.mdreview.printToPDF();
    const filename =
      (this.filePath.split('/').pop() ?? 'document').replace(/\.[^.]+$/, '') + '.pdf';
    await window.mdreview.saveFile({ filename, mimeType: 'application/pdf', data });
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
    const filename =
      (this.filePath.split('/').pop() ?? 'document').replace(/\.[^.]+$/, '') + '.docx';
    await window.mdreview.saveFile({
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
      await this.applyTheme(prefs.theme as string);
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
      void window.mdreview.unwatchFile(this.filePath);
    }
  }

  /**
   * Preprocess markdown/HTML content to rewrite relative URLs to local-asset:// absolute paths.
   * This runs BEFORE the render pipeline so DOMPurify sees the correct protocol and the
   * browser never attempts to load relative paths against the wrong base URL.
   */
  static resolveContentUrls(content: string, filePath: string): string {
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
    const isAbsolute = (url: string) =>
      /^(https?:|data:|mailto:|#|file:|local-asset:|\/\/)/.test(url.trim());
    const resolve = (url: string) => {
      const trimmed = url.trim();
      if (!trimmed || isAbsolute(trimmed)) return url;
      const absPath = trimmed.startsWith('/') ? trimmed : `${dirPath}/${trimmed}`;
      return `local-asset://${absPath}`;
    };

    let result = content;

    // Rewrite markdown images: ![alt](url) or ![alt](url "title")
    result = result.replace(
      /(!\[[^\]]*\]\()(\s*)([^)"'\s]+)(\s*(?:"[^"]*"|'[^']*')?\s*\))/g,
      (_, prefix: string, space: string, url: string, suffix: string) =>
        `${prefix}${space}${resolve(url)}${suffix}`
    );

    // Rewrite markdown links: [text](url) — exclude images (preceded by !)
    result = result.replace(
      /(?<!!)\[([^\]]*)\]\((\s*)([^)"'\s]+)(\s*(?:"[^"]*"|'[^']*')?\s*)\)/g,
      (_, text: string, space: string, url: string, suffix: string) =>
        `[${text}](${space}${resolve(url)}${suffix})`
    );

    // Rewrite HTML src attributes: src="url" or src='url'
    result = result.replace(
      /(\bsrc=)(["'])([^"']*)\2/gi,
      (_, attr: string, quote: string, url: string) => `${attr}${quote}${resolve(url)}${quote}`
    );

    // Rewrite HTML href attributes: href="url" or href='url'
    result = result.replace(
      /(\bhref=)(["'])([^"']*)\2/gi,
      (_, attr: string, quote: string, url: string) => `${attr}${quote}${resolve(url)}${quote}`
    );

    return result;
  }

  private resolveRelativeUrls(container: HTMLElement, filePath: string): void {
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));

    container.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src');
      if (src && !src.match(/^(https?:|data:|file:|local-asset:|\/\/)/)) {
        const absolutePath = src.startsWith('/') ? src : `${dirPath}/${src}`;
        img.src = `local-asset://${absolutePath}`;
      }
    });

    container.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href');
      if (href && !href.match(/^(https?:|mailto:|#|file:|local-asset:|\/\/)/)) {
        const absolutePath = href.startsWith('/') ? href : `${dirPath}/${href}`;
        a.href = `local-asset://${absolutePath}`;
      }
    });
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
            console.error('[mdreview] Auto-reload error:', err);
          }
        })();
      }, 500);
    });

    this.autoReloadCleanup = unwatch;
  }
}

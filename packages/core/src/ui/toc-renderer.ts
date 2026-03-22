/**
 * TOC Renderer
 * Generates and manages a Table of Contents panel
 */

import type { HeadingInfo } from '../types/index';
import { debug } from '../utils/debug-logger';

interface TocOptions {
  maxDepth?: number; // Max heading level to show (1-6)
  autoCollapse?: boolean; // Auto-collapse nested sections
  position?: 'left' | 'right'; // Position of TOC
  scrollContainer?: HTMLElement; // Scroll target (default: window)
}

interface TocNode {
  heading: HeadingInfo;
  children: TocNode[];
  element?: HTMLElement;
  isExpanded?: boolean;
}

export class TocRenderer {
  private container: HTMLElement | null = null;
  private toggleButton: HTMLElement | null = null;
  private headings: HeadingInfo[] = [];
  private options: TocOptions;
  private activeHeadingId: string | null = null;
  private scrollListener: (() => void) | null = null;

  constructor(options: TocOptions = {}) {
    this.options = {
      maxDepth: options.maxDepth || 6,
      autoCollapse: options.autoCollapse !== undefined ? options.autoCollapse : false,
      position: options.position || 'left',
      scrollContainer: options.scrollContainer,
    };
  }

  /**
   * Render the TOC overlay
   */
  render(headings: HeadingInfo[]): HTMLElement {
    debug.info('TOC', `Rendering TOC with ${headings.length} headings`);

    this.headings = headings.filter((h) => h.level <= (this.options.maxDepth || 6));

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'mdreview-toc';
    this.container.className = `mdreview-toc-overlay position-${this.options.position || 'left'}`;

    // Create header
    const header = document.createElement('div');
    header.className = 'mdreview-toc-header';
    header.innerHTML = `
      <span class="mdreview-toc-title">Contents</span>
      <button class="mdreview-toc-close" aria-label="Close table of contents">×</button>
    `;
    this.container.appendChild(header);

    // Create scrollable content area
    const content = document.createElement('div');
    content.className = 'mdreview-toc-content';

    // Build tree structure
    const tree = this.buildTree(this.headings);
    const list = this.renderTree(tree);
    content.appendChild(list);

    this.container.appendChild(content);

    // Setup event listeners
    this.setupEventListeners();

    // Setup scroll spy
    this.setupScrollSpy();

    debug.info('TOC', 'TOC rendered successfully');

    return this.container;
  }

  /**
   * Create on-page toggle button (called separately to always show)
   */
  createToggleButton(): void {
    // Don't create if already exists
    if (this.toggleButton) return;

    this.toggleButton = document.createElement('button');
    this.toggleButton.className = `mdreview-toc-toggle-btn position-${this.options.position || 'left'}`;
    this.toggleButton.setAttribute('aria-label', 'Toggle table of contents');
    this.toggleButton.setAttribute('title', 'Toggle Table of Contents');
    this.toggleButton.innerHTML = '☰';

    this.toggleButton.addEventListener('click', () => {
      this.toggle();
      // Update preferences when toggled
      const newState = this.container?.classList.contains('visible');
      document.dispatchEvent(
        new CustomEvent('mdreview:toc:toggled', {
          detail: { visible: newState },
        })
      );
    });

    document.body.appendChild(this.toggleButton);
  }

  /**
   * Build a hierarchical tree from flat heading list
   */
  private buildTree(headings: HeadingInfo[]): TocNode[] {
    const root: TocNode[] = [];
    const stack: TocNode[] = [];

    for (const heading of headings) {
      const node: TocNode = {
        heading,
        children: [],
        isExpanded: !this.options.autoCollapse || heading.level <= 2,
      };

      // Find the parent node
      while (stack.length > 0) {
        const parent = stack[stack.length - 1];
        if (parent.heading.level < heading.level) {
          parent.children.push(node);
          break;
        }
        stack.pop();
      }

      // If no parent found, add to root
      if (stack.length === 0) {
        root.push(node);
      }

      stack.push(node);
    }

    return root;
  }

  /**
   * Render tree nodes as nested lists
   */
  private renderTree(nodes: TocNode[]): HTMLElement {
    const ul = document.createElement('ul');
    ul.className = 'mdreview-toc-list';

    for (const node of nodes) {
      const li = document.createElement('li');
      li.className = `mdreview-toc-item mdreview-toc-level-${node.heading.level}`;
      li.dataset.headingId = node.heading.id;

      // Create link
      const link = document.createElement('a');
      link.href = `#${node.heading.id}`;
      link.className = 'mdreview-toc-link';
      link.dataset.headingId = node.heading.id;

      const textSpan = document.createElement('span');
      textSpan.className = 'mdreview-toc-link-text';
      textSpan.textContent = node.heading.text;
      link.appendChild(textSpan);

      // Handle click
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.scrollToHeading(node.heading.id);
      });

      li.appendChild(link);
      node.element = li;

      // Add children if any
      if (node.children.length > 0) {
        li.classList.add('has-children');

        // Add expand/collapse toggle
        if (this.options.autoCollapse) {
          const toggle = document.createElement('button');
          toggle.className = 'mdreview-toc-toggle';
          toggle.textContent = node.isExpanded ? '▼' : '▶';
          toggle.setAttribute('aria-label', 'Toggle section');

          toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleNode(node);
          });

          li.insertBefore(toggle, link);
        }

        const childList = this.renderTree(node.children);
        if (!node.isExpanded) {
          childList.style.display = 'none';
        }
        li.appendChild(childList);
      }

      ul.appendChild(li);
    }

    return ul;
  }

  /**
   * Toggle expand/collapse state of a node
   */
  private toggleNode(node: TocNode): void {
    if (!node.element) return;

    node.isExpanded = !node.isExpanded;

    const toggle = node.element.querySelector('.mdreview-toc-toggle');
    const childList = node.element.querySelector('ul');

    if (toggle) {
      toggle.textContent = node.isExpanded ? '▼' : '▶';
    }

    if (childList) {
      childList.style.display = node.isExpanded ? 'block' : 'none';
    }
  }

  /**
   * Scroll to a heading smoothly
   */
  private scrollToHeading(headingId: string): void {
    const target = document.getElementById(headingId);
    if (!target) {
      debug.warn('TOC', `Heading not found: ${headingId}`);
      return;
    }

    const scrollTarget = this.options.scrollContainer;
    if (scrollTarget) {
      // Scroll within the container
      const containerRect = scrollTarget.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offset = targetRect.top - containerRect.top + scrollTarget.scrollTop;
      scrollTarget.scrollTo({ top: offset, behavior: 'smooth' });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Update active state immediately
    this.setActiveHeading(headingId);
  }

  /**
   * Set up scroll spy to highlight current section
   */
  private setupScrollSpy(): void {
    const scrollTarget = this.options.scrollContainer;

    const updateActiveHeading = () => {
      let currentHeading: HeadingInfo | null = null;

      if (scrollTarget) {
        // Container-relative scroll spy
        const containerRect = scrollTarget.getBoundingClientRect();
        const offset = containerRect.top + 100;

        for (let i = this.headings.length - 1; i >= 0; i--) {
          const heading = this.headings[i];
          const element = document.getElementById(heading.id);
          if (element) {
            const rect = element.getBoundingClientRect();
            if (rect.top <= offset) {
              currentHeading = heading;
              break;
            }
          }
        }
      } else {
        // Window-based scroll spy (Chrome extension)
        const scrollPosition = window.scrollY + 100;

        for (let i = this.headings.length - 1; i >= 0; i--) {
          const heading = this.headings[i];
          const element = document.getElementById(heading.id);
          if (element) {
            const offsetTop = element.getBoundingClientRect().top + window.scrollY;
            if (offsetTop <= scrollPosition) {
              currentHeading = heading;
              break;
            }
          }
        }
      }

      if (currentHeading) {
        this.setActiveHeading(currentHeading.id);
      }
    };

    // Throttle scroll events for performance
    let ticking = false;
    this.scrollListener = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateActiveHeading();
          ticking = false;
        });
        ticking = true;
      }
    };

    const listenTarget = scrollTarget || window;
    listenTarget.addEventListener('scroll', this.scrollListener as EventListener, {
      passive: true,
    });

    // Initial update
    updateActiveHeading();
  }

  /**
   * Set the active heading in the TOC
   */
  private setActiveHeading(headingId: string): void {
    if (this.activeHeadingId === headingId) return;

    // Remove previous active state
    if (this.activeHeadingId && this.container) {
      const prevActive = this.container.querySelector(
        `[data-heading-id="${this.activeHeadingId}"]`
      );
      if (prevActive) {
        prevActive.classList.remove('active');
      }
    }

    // Set new active state
    this.activeHeadingId = headingId;

    if (this.container) {
      const newActive = this.container.querySelector(`[data-heading-id="${headingId}"]`);
      if (newActive) {
        newActive.classList.add('active');

        // Scroll TOC to keep active item visible
        const tocContent = this.container.querySelector('.mdreview-toc-content');
        if (tocContent && newActive instanceof HTMLElement) {
          const tocRect = tocContent.getBoundingClientRect();
          const itemRect = newActive.getBoundingClientRect();

          if (itemRect.top < tocRect.top || itemRect.bottom > tocRect.bottom) {
            newActive.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }
      }
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    if (!this.container) return;

    // Close button
    const closeButton = this.container.querySelector('.mdreview-toc-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.hide();
      });
    }

    // Close on escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  /**
   * Show the TOC
   */
  show(): void {
    if (this.container) {
      this.container.classList.add('visible');
      debug.info('TOC', 'TOC shown');
    }
  }

  /**
   * Hide the TOC
   */
  hide(): void {
    if (this.container) {
      this.container.classList.remove('visible');
      debug.info('TOC', 'TOC hidden');

      // Dispatch event for content script to update state
      document.dispatchEvent(new CustomEvent('mdreview:toc:hidden'));
    }
  }

  /**
   * Toggle TOC visibility
   */
  toggle(): void {
    if (this.container?.classList.contains('visible')) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.scrollListener) {
      const listenTarget = this.options.scrollContainer || window;
      listenTarget.removeEventListener('scroll', this.scrollListener as EventListener);
      this.scrollListener = null;
    }

    if (this.toggleButton) {
      this.toggleButton.remove();
      this.toggleButton = null;
    }

    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    debug.info('TOC', 'TOC destroyed');
  }

  /**
   * Update TOC options
   */
  updateOptions(options: Partial<TocOptions>): void {
    this.options = { ...this.options, ...options };

    // Re-render if container exists
    if (this.container && this.headings.length > 0) {
      const wasVisible = this.container.classList.contains('visible');
      const parent = this.container.parentElement;
      this.destroy();
      const newContainer = this.render(this.headings);
      if (parent) {
        parent.appendChild(newContainer);
      } else {
        document.body.appendChild(newContainer);
      }
      // Recreate the toggle button
      this.createToggleButton();
      if (wasVisible) {
        this.show();
      }
    }
  }
}

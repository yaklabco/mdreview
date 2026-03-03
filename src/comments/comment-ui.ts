/**
 * Comment UI Module
 * Renders margin comment cards, input form, and overflow menus.
 * Dispatches custom events for all user actions.
 */

import type { Comment } from '../types';

export class CommentUI {
  private gutter: HTMLElement | null = null;
  private cards: HTMLElement[] = [];
  private activeMenu: HTMLElement | null = null;
  private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

  /**
   * Create the comment gutter container
   */
  createGutter(): HTMLElement {
    this.gutter = document.createElement('div');
    this.gutter.className = 'mdview-comment-gutter';
    return this.gutter;
  }

  /**
   * Render a comment card element
   */
  renderCard(comment: Comment): HTMLElement {
    const card = document.createElement('div');
    card.className = 'mdview-comment-card';
    card.dataset.commentId = comment.id;

    if (comment.resolved) {
      card.classList.add('resolved');
    }

    // Header
    const header = document.createElement('div');
    header.className = 'comment-header';

    const author = document.createElement('strong');
    author.className = 'comment-author';
    author.textContent = comment.author;

    const date = document.createElement('span');
    date.className = 'comment-date';
    date.textContent = this.formatRelativeTime(comment.date);

    const menuBtn = document.createElement('button');
    menuBtn.className = 'comment-menu-btn';
    menuBtn.textContent = '\u2026'; // ellipsis character
    menuBtn.setAttribute('aria-label', 'Comment actions');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showOverflowMenu(comment.id, menuBtn);
    });

    header.appendChild(author);
    header.appendChild(date);
    header.appendChild(menuBtn);

    // Body
    const body = document.createElement('div');
    body.className = 'comment-body';
    body.textContent = comment.body;

    card.appendChild(header);
    card.appendChild(body);

    // Resolved badge
    if (comment.resolved) {
      const badge = document.createElement('span');
      badge.className = 'resolved-badge';
      badge.textContent = 'Resolved';
      card.appendChild(badge);
    }

    // Click on card dispatches focus event
    card.addEventListener('click', () => {
      document.dispatchEvent(
        new CustomEvent('mdview:comment:focus', {
          detail: { commentId: comment.id },
        })
      );
    });

    this.cards.push(card);
    return card;
  }

  /**
   * Show the overflow menu for a comment card
   */
  private showOverflowMenu(commentId: string, anchorElement: HTMLElement): void {
    // Close any existing menu first
    this.closeOverflowMenu();

    const menu = document.createElement('div');
    menu.className = 'mdview-comment-menu';
    menu.setAttribute('role', 'menu');

    const actions = [
      { label: 'Edit', event: 'mdview:comment:edit' },
      { label: 'Resolve', event: 'mdview:comment:resolve' },
      { label: 'Delete', event: 'mdview:comment:delete' },
    ];

    for (const action of actions) {
      const item = document.createElement('button');
      item.className = 'mdview-comment-menu-item';
      item.setAttribute('role', 'menuitem');
      item.textContent = action.label;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        document.dispatchEvent(
          new CustomEvent(action.event, {
            detail: { commentId },
          })
        );
        this.closeOverflowMenu();
      });

      menu.appendChild(item);
    }

    // Position relative to anchor
    anchorElement.parentElement?.appendChild(menu);
    this.activeMenu = menu;

    // Setup click-outside handler. The menu button uses stopPropagation,
    // so registering synchronously is safe.
    this.clickOutsideHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (this.activeMenu && !this.activeMenu.contains(target)) {
        this.closeOverflowMenu();
      }
    };

    document.addEventListener('click', this.clickOutsideHandler);
  }

  /**
   * Close the currently open overflow menu
   */
  private closeOverflowMenu(): void {
    if (this.activeMenu) {
      this.activeMenu.remove();
      this.activeMenu = null;
    }

    if (this.clickOutsideHandler) {
      document.removeEventListener('click', this.clickOutsideHandler);
      this.clickOutsideHandler = null;
    }
  }

  /**
   * Render the comment input form
   */
  renderInputForm(
    onSave: (body: string) => void,
    onCancel: () => void
  ): HTMLElement {
    const form = document.createElement('div');
    form.className = 'mdview-comment-input';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Add a comment...';
    textarea.rows = 3;

    // Cmd+Enter or Ctrl+Enter to save
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSave(textarea.value);
      }
    });

    const actions = document.createElement('div');
    actions.className = 'mdview-comment-input-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'mdview-comment-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      onSave(textarea.value);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'mdview-comment-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      onCancel();
    });

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);

    form.appendChild(textarea);
    form.appendChild(actions);

    return form;
  }

  /**
   * Show a toast notification
   */
  showToast(message: string, duration: number = 2000): void {
    const toast = document.createElement('div');
    toast.className = 'mdview-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Add visible class after a frame for CSS transition
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    // Remove after duration
    setTimeout(() => {
      toast.remove();
    }, duration);
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.closeOverflowMenu();

    // Remove gutter (which also removes cards inside it)
    if (this.gutter) {
      this.gutter.remove();
      this.gutter = null;
    }

    // Remove any cards that were not inside the gutter
    for (const card of this.cards) {
      card.remove();
    }
    this.cards = [];
  }

  /**
   * Format an ISO date string as relative time
   */
  private formatRelativeTime(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'just now';
    }

    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    }

    if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    }

    if (diffDays < 7) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }

    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }
}

/**
 * Comment UI Module
 * Renders margin comment cards, input form, reply forms, reaction pills,
 * emoji picker, and overflow menus.
 * Dispatches custom events for all user actions.
 */

import type { Comment, CommentTag, CommentReply, CommentReactions } from '../types';
import { QUICK_EMOJIS, EMOJI_CATEGORIES, searchEmojis } from './emoji-data';

const ALL_TAGS: CommentTag[] = [
  'blocking', 'nit', 'suggestion', 'question', 'praise', 'todo', 'fyi',
];

export class CommentUI {
  private gutter: HTMLElement | null = null;
  private cards: HTMLElement[] = [];
  private activeMenu: HTMLElement | null = null;
  private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;
  private currentAuthor: string = '';

  /**
   * Set the current author name (used for reaction pill .mine class)
   */
  setCurrentAuthor(author: string): void {
    this.currentAuthor = author;
  }

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
    card.className = 'mdview-comment-card minimized';
    card.dataset.commentId = comment.id;

    if (comment.resolved) {
      card.classList.add('resolved');
    }

    // Header
    const header = document.createElement('div');
    header.className = 'comment-header';

    const author = document.createElement('strong');
    author.className = 'comment-author';
    author.textContent = comment.author || 'Anonymous';

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

    // Snippet (visible only when minimized, via CSS)
    const snippet = document.createElement('div');
    snippet.className = 'comment-snippet';
    const maxLen = 60;
    snippet.textContent = comment.body.length > maxLen
      ? comment.body.slice(0, maxLen) + '...'
      : comment.body;
    card.appendChild(snippet);

    // Tag pills
    if (comment.tags && comment.tags.length > 0) {
      const tagsContainer = document.createElement('div');
      tagsContainer.className = 'comment-tags';
      for (const tag of comment.tags) {
        const pill = document.createElement('span');
        pill.className = `comment-tag comment-tag--${tag}`;
        pill.textContent = tag;
        tagsContainer.appendChild(pill);
      }
      card.appendChild(tagsContainer);
    }

    card.appendChild(body);

    // Replies
    if (comment.replies && comment.replies.length > 0) {
      card.appendChild(this.renderReplies(comment.replies));
    }

    // Reply button (non-resolved only)
    if (!comment.resolved) {
      const replyBtn = document.createElement('button');
      replyBtn.className = 'comment-reply-btn';
      replyBtn.textContent = 'Reply';
      replyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.dispatchEvent(
          new CustomEvent('mdview:comment:reply', {
            detail: { commentId: comment.id },
          })
        );
      });
      card.appendChild(replyBtn);
    }

    // Reactions
    if (this.currentAuthor) {
      card.appendChild(this.renderReactions(comment.id, comment.reactions ?? {}));
    }

    // Resolved badge
    if (comment.resolved) {
      const badge = document.createElement('span');
      badge.className = 'resolved-badge';
      badge.textContent = 'Resolved';
      card.appendChild(badge);
    }

    // Click toggles minimized/expanded state
    card.addEventListener('click', () => {
      const wasMinimized = card.classList.contains('minimized');
      card.classList.toggle('minimized');

      // Only focus the highlight when expanding
      if (wasMinimized) {
        document.dispatchEvent(
          new CustomEvent('mdview:comment:focus', {
            detail: { commentId: comment.id },
          })
        );
      }

      // Always reposition after size change
      document.dispatchEvent(new CustomEvent('mdview:comment:reposition'));
    });

    this.cards.push(card);
    return card;
  }

  /**
   * Render replies section
   */
  private renderReplies(replies: CommentReply[]): HTMLElement {
    const container = document.createElement('div');
    container.className = 'comment-replies';

    for (const reply of replies) {
      const replyEl = document.createElement('div');
      replyEl.className = 'comment-reply';

      const replyHeader = document.createElement('div');
      replyHeader.className = 'comment-reply-header';

      const replyAuthor = document.createElement('strong');
      replyAuthor.className = 'comment-reply-author';
      replyAuthor.textContent = reply.author || 'Anonymous';

      const replyDate = document.createElement('span');
      replyDate.className = 'comment-reply-date';
      replyDate.textContent = this.formatRelativeTime(reply.date);

      replyHeader.appendChild(replyAuthor);
      replyHeader.appendChild(replyDate);

      const replyBody = document.createElement('div');
      replyBody.className = 'comment-reply-body';
      replyBody.textContent = reply.body;

      replyEl.appendChild(replyHeader);
      replyEl.appendChild(replyBody);
      container.appendChild(replyEl);
    }

    return container;
  }

  /**
   * Render reaction pills and "+" button
   */
  private renderReactions(commentId: string, reactions: CommentReactions): HTMLElement {
    const container = document.createElement('div');
    container.className = 'comment-reactions';

    const emojis = Object.keys(reactions);
    for (const emoji of emojis) {
      const authors = reactions[emoji];
      if (!authors || authors.length === 0) continue;

      const pill = document.createElement('button');
      pill.className = 'comment-reaction';
      if (this.currentAuthor && authors.includes(this.currentAuthor)) {
        pill.classList.add('mine');
      }
      pill.textContent = `${emoji} ${authors.length}`;
      pill.dataset.emoji = emoji;
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        document.dispatchEvent(
          new CustomEvent('mdview:comment:react', {
            detail: { commentId, emoji },
          })
        );
      });
      container.appendChild(pill);
    }

    // "+" add reaction button
    const addBtn = document.createElement('button');
    addBtn.className = 'comment-reaction-add';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.dispatchEvent(
        new CustomEvent('mdview:comment:react:picker', {
          detail: { commentId, anchor: addBtn },
        })
      );
    });
    container.appendChild(addBtn);

    return container;
  }

  /**
   * Render a compact reply form (no tag picker)
   */
  renderReplyForm(
    onSave: (body: string) => void,
    onCancel: () => void
  ): HTMLElement {
    const form = document.createElement('div');
    form.className = 'comment-reply-form';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Write a reply...';
    textarea.rows = 2;

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSave(textarea.value);
      }
    });

    const actions = document.createElement('div');
    actions.className = 'mdview-comment-input-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'mdview-comment-btn-save';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      onSave(textarea.value);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'mdview-comment-btn-cancel';
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
   * Render the emoji picker
   */
  renderEmojiPicker(
    _anchor: HTMLElement,
    onSelect: (emoji: string) => void,
    onClose: () => void
  ): HTMLElement {
    const picker = document.createElement('div');
    picker.className = 'mdview-emoji-picker';

    // Quick palette row
    const quickRow = document.createElement('div');
    quickRow.className = 'emoji-picker-quick';
    for (const emoji of QUICK_EMOJIS) {
      const btn = document.createElement('button');
      btn.textContent = emoji.char;
      btn.title = emoji.name;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(emoji.char);
      });
      quickRow.appendChild(btn);
    }
    picker.appendChild(quickRow);

    // Search input
    const searchInput = document.createElement('input');
    searchInput.className = 'emoji-picker-search';
    searchInput.type = 'text';
    searchInput.placeholder = 'Search emojis...';
    picker.appendChild(searchInput);

    // Categorized grid
    const grid = document.createElement('div');
    grid.className = 'emoji-picker-grid';
    this.renderEmojiGrid(grid, EMOJI_CATEGORIES, onSelect);
    picker.appendChild(grid);

    // Search filtering
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim();
      if (query) {
        const results = searchEmojis(query);
        grid.innerHTML = '';
        const catName = document.createElement('div');
        catName.className = 'emoji-picker-category-name';
        catName.textContent = 'Search Results';
        grid.appendChild(catName);
        for (const emoji of results) {
          const btn = document.createElement('button');
          btn.textContent = emoji.char;
          btn.title = emoji.name;
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelect(emoji.char);
          });
          grid.appendChild(btn);
        }
      } else {
        grid.innerHTML = '';
        this.renderEmojiGrid(grid, EMOJI_CATEGORIES, onSelect);
      }
    });

    // Click-outside to dismiss
    const clickOutsideHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!picker.contains(target)) {
        document.removeEventListener('click', clickOutsideHandler);
        onClose();
      }
    };
    document.addEventListener('click', clickOutsideHandler);

    return picker;
  }

  /**
   * Render the categorized emoji grid into a container
   */
  private renderEmojiGrid(
    container: HTMLElement,
    categories: typeof EMOJI_CATEGORIES,
    onSelect: (emoji: string) => void
  ): void {
    for (const cat of categories) {
      const catName = document.createElement('div');
      catName.className = 'emoji-picker-category-name';
      catName.textContent = cat.name;
      container.appendChild(catName);

      for (const emoji of cat.emojis) {
        const btn = document.createElement('button');
        btn.textContent = emoji.char;
        btn.title = emoji.name;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelect(emoji.char);
        });
        container.appendChild(btn);
      }
    }
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
    onSave: (body: string, tags: CommentTag[]) => void,
    onCancel: () => void,
    initialTags?: CommentTag[]
  ): HTMLElement {
    const form = document.createElement('div');
    form.className = 'mdview-comment-input';

    const selectedTags = new Set<CommentTag>(initialTags ?? []);

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Add a comment...';
    textarea.rows = 3;

    const getSelectedTags = (): CommentTag[] =>
      ALL_TAGS.filter((t) => selectedTags.has(t));

    // Cmd+Enter or Ctrl+Enter to save
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSave(textarea.value, getSelectedTags());
      }
    });

    // Tag picker
    const picker = document.createElement('div');
    picker.className = 'comment-tag-picker';
    for (const tag of ALL_TAGS) {
      const pill = document.createElement('span');
      pill.className = `comment-tag-option comment-tag-option--${tag}`;
      pill.textContent = tag;
      if (selectedTags.has(tag)) {
        pill.classList.add('active');
      }
      pill.addEventListener('click', () => {
        if (selectedTags.has(tag)) {
          selectedTags.delete(tag);
          pill.classList.remove('active');
        } else {
          selectedTags.add(tag);
          pill.classList.add('active');
        }
      });
      picker.appendChild(pill);
    }

    const actions = document.createElement('div');
    actions.className = 'mdview-comment-input-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'mdview-comment-btn-save';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      onSave(textarea.value, getSelectedTags());
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'mdview-comment-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      onCancel();
    });

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);

    form.appendChild(textarea);
    form.appendChild(picker);
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

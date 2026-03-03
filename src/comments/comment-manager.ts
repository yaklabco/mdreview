/**
 * Comment Manager
 *
 * CRUD orchestrator that connects the comment parser, serializer, UI,
 * text highlighter, and native host file-writing into a single cohesive
 * controller. All comment lifecycle operations flow through this class.
 */

import type { Comment, CommentParseResult, AppState } from '../types';
import { CommentUI } from './comment-ui';
import { CommentHighlighter } from './comment-highlight';
import { parseComments } from './comment-parser';
import {
  addComment as serializerAddComment,
  removeComment as serializerRemoveComment,
  updateComment as serializerUpdateComment,
  resolveComment as serializerResolveComment,
  generateNextCommentId,
} from './comment-serializer';

export class CommentManager {
  private comments: Comment[] = [];
  private rawMarkdown: string = '';
  private filePath: string = '';
  private writeInProgress = false;
  private ui: CommentUI | null = null;
  private highlighter: CommentHighlighter | null = null;
  private authorName: string = '';

  private eventListeners: Array<{
    event: string;
    handler: EventListener;
  }> = [];

  /** Grace period (ms) after native write before clearing writeInProgress */
  private static readonly WRITE_GUARD_DELAY = 1000;

  /**
   * Parse existing comments from raw markdown, set up UI and highlights,
   * and wire event listeners for user actions.
   */
  async initialize(
    markdown: string,
    filePath: string,
    preferences: AppState['preferences']
  ): Promise<CommentParseResult> {
    this.rawMarkdown = markdown;
    this.filePath = filePath;
    this.authorName = preferences.commentAuthor ?? '';

    // Parse existing comments
    const result = parseComments(markdown);
    this.comments = [...result.comments];

    // Set up UI - create gutter and append to document body
    this.ui = new CommentUI();
    const gutter = this.ui.createGutter();
    document.body.appendChild(gutter);

    for (const comment of this.comments) {
      const card = this.ui.renderCard(comment);
      gutter.appendChild(card);
    }

    // Add has-comments class to body when comments exist
    if (this.comments.length > 0) {
      document.body.classList.add('has-comments');
    }

    // Set up highlighter
    this.highlighter = new CommentHighlighter();
    const container = document.getElementById('mdview-container') || document.body;
    for (const comment of this.comments) {
      this.highlighter.highlightComment(container, comment);
    }

    // Set up context menu for adding comments
    this.setupContextMenu();

    // Wire up custom DOM event listeners
    this.addEventHandler('mdview:comment:edit', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.commentId) {
        this.showEditForm(detail.commentId);
      }
    });

    this.addEventHandler('mdview:comment:resolve', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.commentId) {
        void this.resolveComment(detail.commentId);
      }
    });

    this.addEventHandler('mdview:comment:delete', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.commentId) {
        void this.deleteComment(detail.commentId);
      }
    });

    this.addEventHandler('mdview:comment:focus', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.commentId && this.highlighter) {
        this.highlighter.clearActive();
        this.highlighter.setActive(detail.commentId);
        const el = this.highlighter.getHighlightElement(detail.commentId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });

    return result;
  }

  /**
   * Set up the right-click context menu for creating comments.
   */
  private setupContextMenu(): void {
    this.addEventHandler('contextmenu', (e: Event) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        return; // No text selected, let default context menu through
      }

      e.preventDefault();
      const selectedText = selection.toString().trim();

      // Show input form in the gutter
      if (this.ui) {
        const gutter = document.querySelector('.mdview-comment-gutter');
        if (gutter) {
          // Remove any existing input form
          const existingForm = gutter.querySelector('.mdview-comment-input');
          if (existingForm) existingForm.remove();

          const form = this.ui.renderInputForm(
            (body: string) => {
              if (body.trim()) {
                void this.addComment(selectedText, body);
              }
              form.remove();
            },
            () => form.remove()
          );
          gutter.prepend(form);

          // Focus the textarea
          const textarea = form.querySelector('textarea');
          if (textarea) textarea.focus();
        }
      }
    });
  }

  /**
   * Show the edit form for an existing comment, pre-populated with its body.
   */
  private showEditForm(commentId: string): void {
    const comment = this.comments.find((c) => c.id === commentId);
    if (!comment || !this.ui) return;

    // Find the card and replace its body with an input form
    const card = document.querySelector(
      `.mdview-comment-card[data-comment-id="${commentId}"]`
    );
    if (!card) return;

    const form = this.ui.renderInputForm(
      (newBody: string) => {
        if (newBody.trim()) {
          void this.editComment(commentId, newBody);
        }
        // Restore the card body
        form.remove();
        const bodyEl = card.querySelector('.comment-body');
        if (bodyEl) {
          (bodyEl as HTMLElement).style.display = '';
          bodyEl.textContent = newBody.trim() || comment.body;
        }
      },
      () => {
        form.remove();
        const bodyEl = card.querySelector('.comment-body');
        if (bodyEl) {
          (bodyEl as HTMLElement).style.display = '';
        }
      }
    );

    // Pre-populate textarea
    const textarea = form.querySelector('textarea');
    if (textarea) {
      (textarea as HTMLTextAreaElement).value = comment.body;
    }

    // Hide the card body and insert the form
    const bodyEl = card.querySelector('.comment-body');
    if (bodyEl) {
      (bodyEl as HTMLElement).style.display = 'none';
    }
    card.appendChild(form);

    // Focus the textarea
    if (textarea) (textarea as HTMLTextAreaElement).focus();
  }

  /**
   * Add a new comment attached to selected text.
   */
  async addComment(selectedText: string, body: string): Promise<void> {
    const nextId = generateNextCommentId(this.rawMarkdown);

    const comment: Comment = {
      id: nextId,
      selectedText,
      body,
      author: this.authorName,
      date: new Date().toISOString(),
      resolved: false,
    };

    // Serialize into markdown
    const updatedMarkdown = serializerAddComment(this.rawMarkdown, comment);

    // Write to file
    await this.writeFile(updatedMarkdown);

    // Update internal state
    this.rawMarkdown = updatedMarkdown;
    this.comments.push(comment);

    // Optimistically patch DOM
    const container = document.getElementById('mdview-container') || document.body;
    if (this.highlighter) {
      this.highlighter.highlightComment(container, comment);
    }

    if (this.ui) {
      const card = this.ui.renderCard(comment);
      const gutter = document.querySelector('.mdview-comment-gutter');
      if (gutter) gutter.appendChild(card);
      this.ui.showToast('Comment saved');
    }

    // Add has-comments class if this is the first comment
    if (this.comments.length === 1) {
      document.body.classList.add('has-comments');
    }
  }

  /**
   * Edit the body of an existing comment.
   */
  async editComment(id: string, newBody: string): Promise<void> {
    const updatedMarkdown = serializerUpdateComment(
      this.rawMarkdown,
      id,
      newBody
    );

    await this.writeFile(updatedMarkdown);

    // Update internal state
    this.rawMarkdown = updatedMarkdown;
    const comment = this.comments.find((c) => c.id === id);
    if (comment) {
      comment.body = newBody;
    }
  }

  /**
   * Mark a comment as resolved.
   */
  async resolveComment(id: string): Promise<void> {
    const updatedMarkdown = serializerResolveComment(this.rawMarkdown, id);

    await this.writeFile(updatedMarkdown);

    // Update internal state
    this.rawMarkdown = updatedMarkdown;
    const comment = this.comments.find((c) => c.id === id);
    if (comment) {
      comment.resolved = true;
    }

    // Update highlight to resolved state
    if (this.highlighter) {
      this.highlighter.setResolved(id);
    }
  }

  /**
   * Delete a comment entirely.
   */
  async deleteComment(id: string): Promise<void> {
    const updatedMarkdown = serializerRemoveComment(this.rawMarkdown, id);

    await this.writeFile(updatedMarkdown);

    // Update internal state
    this.rawMarkdown = updatedMarkdown;
    this.comments = this.comments.filter((c) => c.id !== id);

    // Remove highlight from DOM
    if (this.highlighter) {
      this.highlighter.removeHighlight(id);
    }

    // Remove card from DOM
    const card = document.querySelector(
      `.mdview-comment-card[data-comment-id="${id}"]`
    );
    if (card) card.remove();

    // Remove has-comments class if no comments remain
    if (this.comments.length === 0) {
      document.body.classList.remove('has-comments');
    }
  }

  /**
   * Write content to the file via the native messaging host.
   */
  private async writeFile(content: string): Promise<void> {
    this.writeInProgress = true;
    try {
      await chrome.runtime.sendNativeMessage('com.mdview.filewriter', {
        action: 'write',
        path: this.filePath,
        content,
      });
    } finally {
      // Keep the guard active for a grace period so the auto-reload watcher
      // has time to see and ignore the file change event we just caused.
      setTimeout(() => {
        this.writeInProgress = false;
      }, CommentManager.WRITE_GUARD_DELAY);
    }
  }

  /**
   * Whether a file write is currently in progress.
   */
  isWriteInProgress(): boolean {
    return this.writeInProgress;
  }

  /**
   * Return a shallow copy of the current comments array.
   */
  getComments(): Comment[] {
    return [...this.comments];
  }

  /**
   * Clean up UI elements and event listeners.
   */
  destroy(): void {
    if (this.ui) {
      this.ui.destroy();
      this.ui = null;
    }

    for (const { event, handler } of this.eventListeners) {
      document.removeEventListener(event, handler);
    }
    this.eventListeners = [];

    this.highlighter = null;
    this.comments = [];
    document.body.classList.remove('has-comments');
  }

  /**
   * Register a DOM event listener and track it for cleanup.
   */
  private addEventHandler(event: string, handler: EventListener): void {
    document.addEventListener(event, handler);
    this.eventListeners.push({ event, handler });
  }
}

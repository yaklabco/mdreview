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

    // Set up UI
    this.ui = new CommentUI();
    this.ui.createGutter();

    for (const comment of this.comments) {
      this.ui.renderCard(comment);
    }

    // Set up highlighter
    this.highlighter = new CommentHighlighter();
    const container = document.body;
    for (const comment of this.comments) {
      this.highlighter.highlightComment(container, comment);
    }

    // Wire up custom DOM event listeners
    this.addEventHandler('mdview:comment:edit', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.commentId && detail?.body !== undefined) {
        this.editComment(detail.commentId, detail.body);
      }
    });

    this.addEventHandler('mdview:comment:resolve', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.commentId) {
        this.resolveComment(detail.commentId);
      }
    });

    this.addEventHandler('mdview:comment:delete', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.commentId) {
        this.deleteComment(detail.commentId);
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
    if (this.highlighter) {
      this.highlighter.highlightComment(document.body, comment);
    }

    if (this.ui) {
      this.ui.renderCard(comment);
      this.ui.showToast('Comment saved');
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
      this.writeInProgress = false;
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
  }

  /**
   * Register a DOM event listener and track it for cleanup.
   */
  private addEventHandler(event: string, handler: EventListener): void {
    document.addEventListener(event, handler);
    this.eventListeners.push({ event, handler });
  }
}

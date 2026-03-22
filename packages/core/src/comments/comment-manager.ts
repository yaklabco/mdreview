/**
 * Comment Manager (core)
 *
 * CRUD orchestrator that connects the comment parser, serializer, UI,
 * text highlighter, and file-writing into a single cohesive controller.
 * All comment lifecycle operations flow through this class.
 *
 * This core version uses FileAdapter and IdentityAdapter instead of
 * chrome.runtime.sendMessage, allowing it to work in any environment
 * (Chrome extension, Electron, Node.js, tests).
 *
 * Both adapters are optional — the manager degrades gracefully:
 * - Without FileAdapter: file writes are silently skipped
 * - Without IdentityAdapter: empty username is used as fallback
 */

import type { Comment, CommentParseResult, AppState, CommentTag } from '../types/index';
import type { FileAdapter, IdentityAdapter } from '../adapters';
import { CommentUI } from './comment-ui';
import { CommentHighlighter } from './comment-highlight';
import { parseComments } from './annotation-parser';
import {
  addComment as serializerAddComment,
  addCommentAtOffset as serializerAddCommentAtOffset,
  removeComment as serializerRemoveComment,
  updateComment as serializerUpdateComment,
  updateCommentMetadata as serializerUpdateCommentMetadata,
  resolveComment as serializerResolveComment,
  addReply as serializerAddReply,
  toggleReaction as serializerToggleReaction,
  generateNextCommentId,
} from './annotation-serializer';
import { buildSourceMap, findInsertionPoint } from './source-position-map';
import type { SourcePositionMap, SelectionContext } from './source-position-map';
import { computeCommentContext } from './comment-context';

export interface CommentManagerAdapters {
  file?: FileAdapter;
  identity?: IdentityAdapter;
}

export class CommentManager {
  private comments: Comment[] = [];
  private rawMarkdown: string = '';
  private filePath: string = '';
  private writeInProgress = false;
  private ui: CommentUI | null = null;
  private highlighter: CommentHighlighter | null = null;
  private authorName: string = '';
  private sourceMap: SourcePositionMap | null = null;
  private pendingContext: SelectionContext | null = null;

  private readonly fileAdapter: FileAdapter | null;
  private readonly identityAdapter: IdentityAdapter | null;

  private windowListeners: Array<{
    event: string;
    handler: EventListener;
  }> = [];

  private eventListeners: Array<{
    event: string;
    handler: EventListener;
  }> = [];

  /** Grace period (ms) after native write before clearing writeInProgress.
   *  Must exceed file-watcher poll interval (1000ms) + debounce (500ms)
   *  to prevent the auto-reload from triggering on our own write. */
  private static readonly WRITE_GUARD_DELAY = 2000;

  constructor(adapters?: CommentManagerAdapters) {
    this.fileAdapter = adapters?.file ?? null;
    this.identityAdapter = adapters?.identity ?? null;
  }

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

    // If no author configured, try to get username from identity adapter
    if (!this.authorName && this.identityAdapter) {
      try {
        const username = await this.identityAdapter.getUsername();
        if (username) {
          this.authorName = username;
        }
      } catch {
        // Identity adapter may fail — leave author empty
      }
    }

    // Build source position map for accurate comment insertion
    this.sourceMap = buildSourceMap(markdown);

    // Parse existing comments
    const result = parseComments(markdown);
    this.comments = [...result.comments];

    // Set up UI
    this.ui = new CommentUI();
    this.ui.setCurrentAuthor(this.authorName);

    // Set up highlighter - highlight text first, then position cards
    this.highlighter = new CommentHighlighter();
    const container = document.getElementById('mdreview-container') || document.body;
    for (const comment of this.comments) {
      this.highlighter.highlightComment(container, comment);
    }

    // Render cards and position them next to their highlights
    for (const comment of this.comments) {
      const card = this.ui.renderCard(comment);
      document.body.appendChild(card);
      this.positionCardAtHighlight(card, comment.id);
    }

    // Apply cascade layout to prevent card overlap
    this.repositionAllCards();

    // Re-position cards on window resize (debounced)
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeHandler = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this.repositionAllCards(), 150);
    };
    window.addEventListener('resize', resizeHandler);
    this.windowListeners.push({ event: 'resize', handler: resizeHandler as EventListener });

    // Wire up custom DOM event listeners
    this.addEventHandler('mdreview:comment:edit', (e: Event) => {
      const detail = (e as CustomEvent<{ commentId?: string }>).detail;
      if (detail?.commentId) {
        this.showEditForm(detail.commentId);
      }
    });

    this.addEventHandler('mdreview:comment:resolve', (e: Event) => {
      const detail = (e as CustomEvent<{ commentId?: string }>).detail;
      if (detail?.commentId) {
        void this.resolveComment(detail.commentId);
      }
    });

    this.addEventHandler('mdreview:comment:delete', (e: Event) => {
      const detail = (e as CustomEvent<{ commentId?: string }>).detail;
      if (detail?.commentId) {
        void this.deleteComment(detail.commentId);
      }
    });

    this.addEventHandler('mdreview:comment:focus', (e: Event) => {
      const detail = (e as CustomEvent<{ commentId?: string }>).detail;
      if (detail?.commentId && this.highlighter) {
        this.highlighter.clearActive();
        this.highlighter.setActive(detail.commentId);
        const el = this.highlighter.getHighlightElement(detail.commentId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });

    this.addEventHandler('mdreview:comment:reply', (e: Event) => {
      const detail = (e as CustomEvent<{ commentId?: string }>).detail;
      if (detail?.commentId) {
        this.showReplyForm(detail.commentId);
      }
    });

    this.addEventHandler('mdreview:comment:react', (e: Event) => {
      const detail = (e as CustomEvent<{ commentId?: string; emoji?: string }>).detail;
      if (detail?.commentId && detail?.emoji) {
        void this.toggleReaction(detail.commentId, detail.emoji);
      }
    });

    this.addEventHandler('mdreview:comment:reposition', () => {
      this.repositionAllCards();
    });

    this.addEventHandler('mdreview:comment:react:picker', (e: Event) => {
      const detail = (e as CustomEvent<{ commentId?: string; anchor?: HTMLElement }>).detail;
      if (detail?.commentId) {
        this.showEmojiPicker(detail.commentId, detail.anchor);
      }
    });

    return result;
  }

  /**
   * Handle an "add comment" request from the Chrome context menu.
   * Captures current DOM selection context if available, shows the input form,
   * and creates the comment on save.
   */
  handleAddCommentRequest(selectionText: string): void {
    if (!this.ui) return;

    // Remove any existing input form
    document.querySelector('.mdreview-comment-input')?.remove();

    // Try to capture DOM context from current selection (may still be active)
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      this.pendingContext = {
        prefix: this.getTextBefore(range, 30),
        suffix: this.getTextAfter(range, 30),
      };
    }

    // Position form at selection if available, otherwise top of viewport
    let top = window.scrollY + 100;
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      top = rect.top + window.scrollY;
    }

    const form = this.ui.renderInputForm(
      (body: string, tags: CommentTag[]) => {
        if (body.trim()) {
          void this.addComment(selectionText, body, tags.length > 0 ? tags : undefined);
        }
        form.remove();
      },
      () => form.remove()
    );

    form.style.top = `${top}px`;
    document.body.appendChild(form);

    const textarea = form.querySelector('textarea');
    if (textarea) textarea.focus();
  }

  /**
   * Show the edit form for an existing comment, pre-populated with its body.
   */
  private showEditForm(commentId: string): void {
    const comment = this.comments.find((c) => c.id === commentId);
    if (!comment || !this.ui) return;

    // Find the card and replace its body with an input form
    const card = document.querySelector(`.mdreview-comment-card[data-comment-id="${commentId}"]`);
    if (!card) return;

    // Expand the card if it's minimized so the edit form is visible
    if (card.classList.contains('minimized')) {
      card.classList.remove('minimized');
      this.repositionAllCards();
    }

    const form = this.ui.renderInputForm(
      (newBody: string, tags: CommentTag[]) => {
        if (newBody.trim()) {
          void this.editComment(commentId, newBody, tags);
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
      },
      comment.tags
    );

    // Pre-populate textarea
    const textarea = form.querySelector('textarea');
    if (textarea) {
      textarea.value = comment.body;
    }

    // Hide the card body and insert the form
    const bodyEl = card.querySelector('.comment-body');
    if (bodyEl) {
      (bodyEl as HTMLElement).style.display = 'none';
    }
    card.appendChild(form);

    // Focus the textarea
    if (textarea) textarea.focus();
  }

  /**
   * Add a new comment attached to selected text.
   */
  async addComment(selectedText: string, body: string, tags?: CommentTag[]): Promise<void> {
    const nextId = generateNextCommentId(this.rawMarkdown);

    // Compute insertion offset for positional context
    const offset = this.sourceMap
      ? findInsertionPoint(this.sourceMap, selectedText, this.pendingContext ?? undefined)
      : null;

    // Compute positional context from the offset (or fallback to text search)
    const contentSection = this.getContentSection();
    const contextOffset = offset ?? contentSection.indexOf(selectedText);
    const context =
      contextOffset >= 0 ? computeCommentContext(contentSection, contextOffset) : undefined;

    const comment: Comment = {
      id: nextId,
      selectedText,
      body,
      author: this.authorName,
      date: new Date().toISOString(),
      resolved: false,
      context,
      ...(tags && tags.length > 0 ? { tags } : {}),
      ...(this.pendingContext?.prefix ? { anchorPrefix: this.pendingContext.prefix } : {}),
      ...(this.pendingContext?.suffix ? { anchorSuffix: this.pendingContext.suffix } : {}),
    };

    // Serialize into markdown using source map for accurate placement
    const updatedMarkdown = this.sourceMap
      ? serializerAddCommentAtOffset(
          this.rawMarkdown,
          comment,
          this.sourceMap,
          this.pendingContext ?? undefined
        )
      : serializerAddComment(this.rawMarkdown, comment);
    this.pendingContext = null;

    // Update internal state immediately (optimistic)
    this.rawMarkdown = updatedMarkdown;
    this.sourceMap = buildSourceMap(updatedMarkdown);
    this.comments.push(comment);

    // Patch DOM immediately (optimistic)
    const container = document.getElementById('mdreview-container') || document.body;
    if (this.highlighter) {
      this.highlighter.highlightComment(container, comment);
    }

    if (this.ui) {
      const card = this.ui.renderCard(comment);
      document.body.appendChild(card);
      this.positionCardAtHighlight(card, comment.id);
      this.repositionAllCards();
    }

    // Write to file via adapter (if available)
    try {
      await this.writeFile(updatedMarkdown);
      if (this.ui) this.ui.showToast('Comment saved');
    } catch (error) {
      console.error('[MDReview] Comment write failed:', error);
      if (this.ui)
        this.ui.showToast(
          `Write failed: ${error instanceof Error ? error.message : String(error)}`
        );
    }
  }

  /**
   * Edit the body of an existing comment.
   */
  async editComment(id: string, newBody: string, tags?: CommentTag[]): Promise<void> {
    let updatedMarkdown = serializerUpdateComment(this.rawMarkdown, id, newBody);

    // Update internal state immediately.
    // No source map rebuild needed — edit only changes the comments section
    // (below the separator), which the source map does not cover.
    const comment = this.comments.find((c) => c.id === id);

    // Persist tag changes to metadata if tags were explicitly provided and differ
    if (comment && tags !== undefined) {
      const oldTags = comment.tags ?? [];
      const newTags = tags.length > 0 ? tags : [];
      const tagsChanged =
        oldTags.length !== newTags.length || oldTags.some((t, i) => t !== newTags[i]);

      if (tagsChanged) {
        updatedMarkdown = serializerUpdateCommentMetadata(updatedMarkdown, id, (meta) => {
          if (newTags.length > 0) {
            meta.tags = newTags;
          } else {
            delete meta.tags;
          }
        });
      }
    }

    this.rawMarkdown = updatedMarkdown;
    if (comment) {
      comment.body = newBody;
      if (tags !== undefined) {
        comment.tags = tags.length > 0 ? tags : undefined;
      }
    }

    // Write to file
    try {
      await this.writeFile(updatedMarkdown);
      if (this.ui) this.ui.showToast('Comment updated');
    } catch {
      if (this.ui) this.ui.showToast('Comment updated locally (file write failed)');
    }
  }

  /**
   * Mark a comment as resolved.
   */
  async resolveComment(id: string): Promise<void> {
    const updatedMarkdown = serializerResolveComment(this.rawMarkdown, id);

    // Update internal state immediately.
    // No source map rebuild needed — resolve only changes metadata in the
    // comments section (below the separator).
    this.rawMarkdown = updatedMarkdown;
    const comment = this.comments.find((c) => c.id === id);
    if (comment) {
      comment.resolved = true;
    }

    // Update highlight to resolved state immediately
    if (this.highlighter) {
      this.highlighter.setResolved(id);
    }

    // Write to file
    try {
      await this.writeFile(updatedMarkdown);
    } catch {
      if (this.ui) this.ui.showToast('Resolved locally (file write failed)');
    }
  }

  /**
   * Delete a comment entirely.
   */
  async deleteComment(id: string): Promise<void> {
    const updatedMarkdown = serializerRemoveComment(this.rawMarkdown, id);

    // Update internal state immediately
    this.rawMarkdown = updatedMarkdown;
    this.sourceMap = buildSourceMap(updatedMarkdown);
    this.comments = this.comments.filter((c) => c.id !== id);

    // Remove highlight from DOM immediately
    if (this.highlighter) {
      this.highlighter.removeHighlight(id);
    }

    // Remove card from DOM and reposition remaining cards
    const card = document.querySelector(`.mdreview-comment-card[data-comment-id="${id}"]`);
    if (card) card.remove();
    this.repositionAllCards();

    // Write to file
    try {
      await this.writeFile(updatedMarkdown);
    } catch {
      if (this.ui) this.ui.showToast('Deleted locally (file write failed)');
    }
  }

  /**
   * Write content to the file via the FileAdapter.
   * If no FileAdapter is configured, the write is silently skipped.
   */
  private async writeFile(content: string): Promise<void> {
    if (!this.fileAdapter) {
      // No file adapter — graceful degradation, skip write
      return;
    }

    this.writeInProgress = true;
    try {
      const result = await this.fileAdapter.writeFile(this.filePath, content);

      if (!result.success && result.error) {
        throw new Error(result.error);
      }
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
   * Extract visible text preceding a Range from the DOM.
   */
  private getTextBefore(range: Range, maxChars: number): string {
    const container = document.getElementById('mdreview-container') || document.body;
    const treeWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const texts: string[] = [];

    while (treeWalker.nextNode()) {
      const node = treeWalker.currentNode as Text;
      if (node === range.startContainer) {
        texts.push(node.textContent?.slice(0, range.startOffset) ?? '');
        break;
      }
      texts.push(node.textContent ?? '');
    }

    const fullText = texts.join('');
    return fullText.slice(-maxChars);
  }

  /**
   * Extract visible text following a Range from the DOM.
   */
  private getTextAfter(range: Range, maxChars: number): string {
    const container = document.getElementById('mdreview-container') || document.body;
    const treeWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const texts: string[] = [];
    let started = false;

    while (treeWalker.nextNode()) {
      const node = treeWalker.currentNode as Text;
      if (node === range.endContainer) {
        texts.push(node.textContent?.slice(range.endOffset) ?? '');
        started = true;
        continue;
      }
      if (started) {
        texts.push(node.textContent ?? '');
      }
    }

    const fullText = texts.join('');
    return fullText.slice(0, maxChars);
  }

  /**
   * Add a reply to an existing comment.
   */
  async addReply(commentId: string, body: string): Promise<void> {
    const reply = {
      author: this.authorName,
      body,
      date: new Date().toISOString(),
    };

    const { markdown: updatedMarkdown, replyId } = serializerAddReply(
      this.rawMarkdown,
      commentId,
      reply
    );

    // Update internal state
    this.rawMarkdown = updatedMarkdown;
    const comment = this.comments.find((c) => c.id === commentId);
    if (comment) {
      const replies = comment.replies ?? [];
      replies.push({ id: replyId, ...reply });
      comment.replies = replies;
    }

    // Refresh the card content
    this.refreshCardContent(commentId);

    // Write to file
    try {
      await this.writeFile(updatedMarkdown);
      if (this.ui) this.ui.showToast('Reply saved');
    } catch {
      if (this.ui) this.ui.showToast('Reply saved locally (file write failed)');
    }
  }

  /**
   * Toggle an emoji reaction on a comment.
   */
  async toggleReaction(commentId: string, emoji: string): Promise<void> {
    const updatedMarkdown = serializerToggleReaction(
      this.rawMarkdown,
      commentId,
      emoji,
      this.authorName
    );

    // Update internal state
    this.rawMarkdown = updatedMarkdown;
    const comment = this.comments.find((c) => c.id === commentId);
    if (comment) {
      const reactions = comment.reactions ?? {};
      const authors = reactions[emoji] ?? [];
      const idx = authors.indexOf(this.authorName);
      if (idx >= 0) {
        authors.splice(idx, 1);
        if (authors.length === 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = authors;
        }
      } else {
        reactions[emoji] = [...authors, this.authorName];
      }

      if (Object.keys(reactions).length > 0) {
        comment.reactions = reactions;
      } else {
        delete comment.reactions;
      }
    }

    // Refresh the card content
    this.refreshCardContent(commentId);

    // Write to file
    try {
      await this.writeFile(updatedMarkdown);
    } catch {
      if (this.ui) this.ui.showToast('Reaction saved locally (file write failed)');
    }
  }

  /**
   * Show a reply form in the comment card.
   */
  private showReplyForm(commentId: string): void {
    if (!this.ui) return;

    const card = document.querySelector(`.mdreview-comment-card[data-comment-id="${commentId}"]`);
    if (!card) return;

    // Remove any existing reply form
    card.querySelector('.comment-reply-form')?.remove();

    const form = this.ui.renderReplyForm(
      (body: string) => {
        if (body.trim()) {
          void this.addReply(commentId, body);
        }
        form.remove();
      },
      () => form.remove()
    );

    // Insert form before the reply button or reactions
    const replyBtn = card.querySelector('.comment-reply-btn');
    if (replyBtn) {
      card.insertBefore(form, replyBtn);
    } else {
      card.appendChild(form);
    }

    const textarea = form.querySelector('textarea');
    if (textarea) textarea.focus();
  }

  /**
   * Show the emoji picker anchored to a button.
   */
  private showEmojiPicker(commentId: string, anchor?: HTMLElement): void {
    if (!this.ui) return;

    // Remove any existing picker
    document.querySelector('.mdreview-emoji-picker')?.remove();

    const anchorEl =
      anchor ||
      (document.querySelector(
        `.mdreview-comment-card[data-comment-id="${commentId}"] .comment-reaction-add`
      ) as HTMLElement);

    if (!anchorEl) return;

    const picker = this.ui.renderEmojiPicker(
      anchorEl,
      (emoji: string) => {
        void this.toggleReaction(commentId, emoji);
        picker.remove();
      },
      () => picker.remove()
    );

    // Position picker near the anchor
    const card = anchorEl.closest('.mdreview-comment-card');
    if (card) {
      card.appendChild(picker);
    } else {
      document.body.appendChild(picker);
    }
  }

  /**
   * Re-render the replies and reactions sections of an existing card
   * without destroying the entire card.
   */
  private refreshCardContent(commentId: string): void {
    if (!this.ui) return;

    const comment = this.comments.find((c) => c.id === commentId);
    if (!comment) return;

    const oldCard = document.querySelector(
      `.mdreview-comment-card[data-comment-id="${commentId}"]`
    );
    if (!oldCard) return;

    // Replace the card with a freshly rendered one, preserving position and minimized state
    const topStyle = (oldCard as HTMLElement).style.top;
    const wasMinimized = oldCard.classList.contains('minimized');
    const newCard = this.ui.renderCard(comment);
    newCard.style.top = topStyle;
    if (!wasMinimized) {
      newCard.classList.remove('minimized');
    }
    oldCard.replaceWith(newCard);
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

    for (const { event, handler } of this.windowListeners) {
      window.removeEventListener(event, handler);
    }
    this.windowListeners = [];

    this.highlighter = null;
    this.sourceMap = null;
    this.pendingContext = null;
    this.comments = [];

    // Remove any floating cards/forms from DOM
    document
      .querySelectorAll('.mdreview-comment-card, .mdreview-comment-input')
      .forEach((el) => el.remove());
  }

  /**
   * Extract the content section of markdown (above the comments separator).
   */
  private getContentSection(): string {
    const v1a = this.rawMarkdown.indexOf('<!-- mdreview:comments -->');
    const v1b = this.rawMarkdown.indexOf('<!-- mdview:comments -->');
    const v1 = v1a !== -1 && v1b !== -1 ? Math.min(v1a, v1b) : v1a !== -1 ? v1a : v1b;
    const v2a = this.rawMarkdown.indexOf('<!-- mdreview:annotations');
    const v2b = this.rawMarkdown.indexOf('<!-- mdview:annotations');
    const v2 = v2a !== -1 && v2b !== -1 ? Math.min(v2a, v2b) : v2a !== -1 ? v2a : v2b;
    const boundaries = [v1, v2].filter((i) => i !== -1);
    if (boundaries.length === 0) return this.rawMarkdown;
    return this.rawMarkdown.slice(0, Math.min(...boundaries));
  }

  /**
   * Position a comment card in the right margin, aligned with its highlight.
   */
  private positionCardAtHighlight(card: HTMLElement, commentId: string): void {
    if (!this.highlighter) return;

    const highlight = this.highlighter.getHighlightElement(commentId);
    if (!highlight) return;

    const rect = highlight.getBoundingClientRect();
    const scrollTop = window.scrollY;
    card.style.top = `${rect.top + scrollTop}px`;
  }

  /**
   * Reposition all comment cards with cascade logic to prevent overlap.
   * Cards are sorted by their highlight's vertical position and shifted
   * down when they would overlap a previous card.
   */
  private repositionAllCards(): void {
    if (!this.highlighter) return;

    const GAP = 8;
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.mdreview-comment-card'));

    // Pair each card with its highlight's Y position
    const entries: Array<{ card: HTMLElement; desiredTop: number }> = [];
    for (const card of cards) {
      const commentId = card.dataset.commentId;
      if (!commentId) continue;

      const highlight = this.highlighter.getHighlightElement(commentId);
      if (!highlight) continue;

      const rect = highlight.getBoundingClientRect();
      entries.push({
        card,
        desiredTop: rect.top + window.scrollY,
      });
    }

    // Sort by desired vertical position
    entries.sort((a, b) => a.desiredTop - b.desiredTop);

    // Cascade: push cards down when they'd overlap the previous card
    let prevBottom = -Infinity;
    for (const { card, desiredTop } of entries) {
      const top = desiredTop < prevBottom + GAP ? prevBottom + GAP : desiredTop;
      card.style.top = `${top}px`;
      prevBottom = top + card.offsetHeight;
    }
  }

  /**
   * Register a DOM event listener and track it for cleanup.
   */
  private addEventHandler(event: string, handler: EventListener): void {
    document.addEventListener(event, handler);
    this.eventListeners.push({ event, handler });
  }
}

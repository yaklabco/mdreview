import type { Comment } from '../types';

const HIGHLIGHT_CLASS = 'mdview-comment-highlight';
const COMMENT_ID_ATTR = 'data-comment-id';

/**
 * Manages text highlighting in the rendered DOM for margin comments.
 *
 * Uses TreeWalker to locate text nodes and the Range API to wrap
 * matched substrings without disrupting the surrounding DOM structure.
 */
export class CommentHighlighter {
  /**
   * Find the first text node within `container` that contains `selectedText`,
   * wrap the matching portion in a highlight `<span>`, and return it.
   *
   * Returns `null` if no matching text is found.
   */
  highlightComment(
    container: HTMLElement,
    comment: Comment
  ): HTMLElement | null {
    const { selectedText, id, resolved } = comment;

    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const text = node.textContent ?? '';
      const index = text.indexOf(selectedText);
      if (index === -1) {
        continue;
      }

      // Use the Range API to isolate and wrap the matching substring
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + selectedText.length);

      const span = document.createElement('span');
      span.className = HIGHLIGHT_CLASS;
      if (resolved) {
        span.classList.add('resolved');
      }
      span.setAttribute(COMMENT_ID_ATTR, id);

      range.surroundContents(span);
      return span;
    }

    return null;
  }

  /**
   * Remove the highlight span for `commentId`, replacing it with its
   * plain text content and normalising adjacent text nodes.
   */
  removeHighlight(commentId: string): void {
    const span = document.querySelector(
      `.${HIGHLIGHT_CLASS}[${COMMENT_ID_ATTR}="${commentId}"]`
    );
    if (!span) {
      return;
    }

    const parent = span.parentNode;
    if (!parent) {
      return;
    }

    // Replace the span with its text content
    const textNode = document.createTextNode(span.textContent ?? '');
    parent.replaceChild(textNode, span);

    // Merge adjacent text nodes so the DOM stays clean
    parent.normalize();
  }

  /**
   * Mark the highlight span for `commentId` as active (adds `.active` class).
   */
  setActive(commentId: string): void {
    const span = this.getHighlightElement(commentId);
    if (span) {
      span.classList.add('active');
    }
  }

  /**
   * Remove the `.active` class from all highlight spans in the document.
   */
  clearActive(): void {
    const spans = document.querySelectorAll(`.${HIGHLIGHT_CLASS}.active`);
    for (const span of spans) {
      span.classList.remove('active');
    }
  }

  /**
   * Mark the highlight span for `commentId` as resolved (adds `.resolved` class).
   */
  setResolved(commentId: string): void {
    const span = this.getHighlightElement(commentId);
    if (span) {
      span.classList.add('resolved');
    }
  }

  /**
   * Return the highlight `<span>` for the given `commentId`, or `null`
   * if it does not exist in the document.
   */
  getHighlightElement(commentId: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(
      `.${HIGHLIGHT_CLASS}[${COMMENT_ID_ATTR}="${commentId}"]`
    );
  }
}

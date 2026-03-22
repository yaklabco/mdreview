import type { Comment } from '../types/index';

const HIGHLIGHT_CLASS = 'mdreview-comment-highlight';
const COMMENT_ID_ATTR = 'data-comment-id';

/**
 * Manages text highlighting in the rendered DOM for margin comments.
 *
 * Uses TreeWalker to locate text nodes and the Range API to wrap
 * matched substrings without disrupting the surrounding DOM structure.
 * Supports selections that span across inline element boundaries.
 */
export class CommentHighlighter {
  /**
   * Find text within `container` that matches `selectedText`,
   * wrap the matching portions in highlight `<span>` elements,
   * and return the first span (used for card positioning).
   *
   * Handles text that spans across inline elements (e.g. bold, italic, code)
   * by wrapping each text node portion separately with the same comment ID.
   *
   * Returns `null` if no matching text is found.
   */
  highlightComment(container: HTMLElement, comment: Comment): HTMLElement | null {
    const { selectedText, id, resolved } = comment;

    // Collect all text nodes and build a concatenated string
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      textNodes.push(node);
    }

    // Build concatenated text with offset mappings.
    // Insert a synthetic space between text nodes in different block-level
    // parents so cross-block selections can match even when the DOM has no
    // whitespace text node between adjacent block elements.
    const BLOCK_TAGS = new Set([
      'ADDRESS',
      'ARTICLE',
      'ASIDE',
      'BLOCKQUOTE',
      'DD',
      'DETAILS',
      'DIV',
      'DL',
      'DT',
      'FIELDSET',
      'FIGCAPTION',
      'FIGURE',
      'FOOTER',
      'FORM',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'HEADER',
      'HGROUP',
      'HR',
      'LI',
      'MAIN',
      'NAV',
      'OL',
      'P',
      'PRE',
      'SECTION',
      'TABLE',
      'UL',
    ]);

    const closestBlock = (node: Node): Element | null => {
      let el: Node | null = node.parentNode;
      while (el && el !== container) {
        if (el.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((el as Element).tagName)) {
          return el as Element;
        }
        el = el.parentNode;
      }
      return null;
    };

    let concat = '';
    const nodeOffsets: Array<{ node: Text; start: number; end: number }> = [];
    let prevBlock: Element | null = null;
    for (const textNode of textNodes) {
      const text = textNode.textContent ?? '';
      const block = closestBlock(textNode);
      // Insert a space when crossing block boundaries (if concat doesn't
      // already end with whitespace)
      if (prevBlock !== null && block !== prevBlock && concat.length > 0 && !/\s$/.test(concat)) {
        concat += ' ';
      }
      prevBlock = block;
      const start = concat.length;
      concat += text;
      nodeOffsets.push({ node: textNode, start, end: concat.length });
    }

    // Find the selected text in the concatenated string.
    // Try exact match first; fall back to whitespace-normalized match
    // for cross-block selections where the browser inserts \n between
    // block elements that may differ from the DOM text nodes.
    let matchIndex = concat.indexOf(selectedText);
    let matchEnd: number;

    if (matchIndex !== -1) {
      matchEnd = matchIndex + selectedText.length;
    } else {
      // Build a mapping from normalized offsets back to original offsets
      const normalizedChars: number[] = []; // normalizedChars[i] = original index
      let prevWs = false;
      for (let i = 0; i < concat.length; i++) {
        const isWs = /\s/.test(concat[i]);
        if (isWs && prevWs) continue; // collapse consecutive whitespace
        normalizedChars.push(i);
        prevWs = isWs;
      }
      const normalizedConcat = normalizedChars
        .map((i) => (/\s/.test(concat[i]) ? ' ' : concat[i]))
        .join('');
      const normalizedSearch = selectedText.replace(/\s+/g, ' ');

      const normIdx = normalizedConcat.indexOf(normalizedSearch);
      if (normIdx === -1) {
        return null;
      }

      matchIndex = normalizedChars[normIdx];
      // Map the end: normIdx + normalizedSearch.length may be past the end
      const normEnd = normIdx + normalizedSearch.length;
      matchEnd = normEnd < normalizedChars.length ? normalizedChars[normEnd] : concat.length;
    }

    // Find which text nodes overlap with the match
    const overlapping = nodeOffsets.filter(
      (entry) => entry.start < matchEnd && entry.end > matchIndex
    );

    if (overlapping.length === 0) {
      return null;
    }

    // Single text node — use the simple Range.surroundContents approach
    if (overlapping.length === 1) {
      const entry = overlapping[0];
      const localStart = matchIndex - entry.start;
      const localEnd = localStart + selectedText.length;

      const range = document.createRange();
      range.setStart(entry.node, localStart);
      range.setEnd(entry.node, localEnd);

      const span = document.createElement('span');
      span.className = HIGHLIGHT_CLASS;
      if (resolved) {
        span.classList.add('resolved');
      }
      span.setAttribute(COMMENT_ID_ATTR, id);

      range.surroundContents(span);
      return span;
    }

    // Cross-node: wrap each overlapping text node's matched portion
    let firstSpan: HTMLElement | null = null;

    // Process in reverse order so DOM mutations don't shift subsequent nodes
    for (let i = overlapping.length - 1; i >= 0; i--) {
      const entry = overlapping[i];
      const localStart = Math.max(0, matchIndex - entry.start);
      const localEnd = Math.min(entry.node.textContent?.length ?? 0, matchEnd - entry.start);

      const range = document.createRange();
      range.setStart(entry.node, localStart);
      range.setEnd(entry.node, localEnd);

      const span = document.createElement('span');
      span.className = HIGHLIGHT_CLASS;
      if (resolved) {
        span.classList.add('resolved');
      }
      span.setAttribute(COMMENT_ID_ATTR, id);

      range.surroundContents(span);
      firstSpan = span;
    }

    return firstSpan;
  }

  /**
   * Remove all highlight spans for `commentId`, replacing each with its
   * plain text content and normalising adjacent text nodes.
   */
  removeHighlight(commentId: string): void {
    const spans = document.querySelectorAll(
      `.${HIGHLIGHT_CLASS}[${COMMENT_ID_ATTR}="${commentId}"]`
    );

    for (const span of spans) {
      const parent = span.parentNode;
      if (!parent) continue;

      const textNode = document.createTextNode(span.textContent ?? '');
      parent.replaceChild(textNode, span);
      parent.normalize();
    }
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
   * Return the first highlight `<span>` for the given `commentId`, or `null`
   * if it does not exist in the document.
   */
  getHighlightElement(commentId: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(
      `.${HIGHLIGHT_CLASS}[${COMMENT_ID_ATTR}="${commentId}"]`
    );
  }
}

import { describe, it, expect, beforeEach } from 'vitest';
import { CommentHighlighter } from '@mdview/core';
import type { Comment } from '@mdview/core';

describe('CommentHighlighter', () => {
  let container: HTMLElement;
  let highlighter: CommentHighlighter;

  beforeEach(() => {
    container = document.createElement('div');
    highlighter = new CommentHighlighter();
  });

  describe('highlightComment', () => {
    it('should wrap matching text in a highlight span', () => {
      container.innerHTML = '<p>The quick brown fox jumps over.</p>';
      const comment: Comment = {
        id: 'comment-1',
        selectedText: 'brown fox',
        body: 'test',
        author: 'james',
        date: '2026-03-03T14:30:00Z',
        resolved: false,
      };

      const span = highlighter.highlightComment(container, comment);

      expect(span).not.toBeNull();
      expect(span!.className).toBe('mdview-comment-highlight');
      expect(span!.dataset.commentId).toBe('comment-1');
      expect(span!.textContent).toBe('brown fox');
      expect(container.textContent).toBe('The quick brown fox jumps over.');
    });

    it('should return null when text is not found', () => {
      container.innerHTML = '<p>Hello world.</p>';
      const comment: Comment = {
        id: 'comment-1',
        selectedText: 'missing text',
        body: 'test',
        author: 'james',
        date: '2026-03-03T14:30:00Z',
        resolved: false,
      };

      const span = highlighter.highlightComment(container, comment);
      expect(span).toBeNull();
    });

    it('should add resolved class for resolved comments', () => {
      container.innerHTML = '<p>Some text here.</p>';
      const comment: Comment = {
        id: 'comment-1',
        selectedText: 'text',
        body: 'test',
        author: 'james',
        date: '2026-03-03T14:30:00Z',
        resolved: true,
      };

      const span = highlighter.highlightComment(container, comment);
      expect(span!.classList.contains('resolved')).toBe(true);
    });

    it('should handle text that spans part of a text node', () => {
      container.innerHTML = '<p>Start of the sentence here and more.</p>';
      const comment: Comment = {
        id: 'comment-1',
        selectedText: 'sentence here',
        body: 'test',
        author: 'james',
        date: '2026-03-03T14:30:00Z',
        resolved: false,
      };

      const span = highlighter.highlightComment(container, comment);
      expect(span!.textContent).toBe('sentence here');
      // The surrounding text should still be there
      expect(container.textContent).toBe('Start of the sentence here and more.');
    });

    it('should highlight text spanning across inline elements', () => {
      container.innerHTML = '<p>Some <strong>bold</strong> text here.</p>';
      const comment: Comment = {
        id: 'comment-1',
        selectedText: 'bold text',
        body: 'test',
        author: 'james',
        date: '2026-03-03T14:30:00Z',
        resolved: false,
      };

      const span = highlighter.highlightComment(container, comment);
      expect(span).not.toBeNull();
      expect(span!.dataset.commentId).toBe('comment-1');
      // The full selected text should be visible
      expect(container.textContent).toBe('Some bold text here.');
    });

    it('should highlight text spanning across multiple inline elements', () => {
      container.innerHTML = '<p>Start <em>italic</em> and <strong>bold</strong> end.</p>';
      const comment: Comment = {
        id: 'comment-1',
        selectedText: 'italic and bold',
        body: 'test',
        author: 'james',
        date: '2026-03-03T14:30:00Z',
        resolved: false,
      };

      const span = highlighter.highlightComment(container, comment);
      expect(span).not.toBeNull();
      expect(container.textContent).toBe('Start italic and bold end.');
    });

    it('should highlight text spanning from plain text into an inline element', () => {
      container.innerHTML = '<p>Hello world <code>code here</code> after.</p>';
      const comment: Comment = {
        id: 'comment-1',
        selectedText: 'world code',
        body: 'test',
        author: 'james',
        date: '2026-03-03T14:30:00Z',
        resolved: false,
      };

      const span = highlighter.highlightComment(container, comment);
      expect(span).not.toBeNull();
      expect(container.textContent).toBe('Hello world code here after.');
    });

    it('should highlight text spanning across block elements with whitespace normalization', () => {
      container.innerHTML =
        '<h2>Migration path</h2><p>to the new platform requires careful planning.</p>';
      const comment: Comment = {
        id: 'comment-1',
        selectedText: 'Migration path\nto the new platform',
        body: 'test',
        author: 'james',
        date: '2026-03-03T14:30:00Z',
        resolved: false,
      };

      const span = highlighter.highlightComment(container, comment);
      expect(span).not.toBeNull();
      expect(span!.dataset.commentId).toBe('comment-1');
    });

    it('should highlight text when selection has extra whitespace between blocks', () => {
      container.innerHTML = '<h3>Section Title</h3>\n<p>Body text follows here.</p>';
      const comment: Comment = {
        id: 'comment-1',
        selectedText: 'Section Title\n\nBody text follows',
        body: 'test',
        author: 'james',
        date: '2026-03-03T14:30:00Z',
        resolved: false,
      };

      const span = highlighter.highlightComment(container, comment);
      expect(span).not.toBeNull();
    });

    it('should return first span for cross-node highlights usable for positioning', () => {
      container.innerHTML = '<p>Some <strong>bold</strong> text.</p>';
      document.body.appendChild(container);

      const comment: Comment = {
        id: 'comment-1',
        selectedText: 'bold text',
        body: 'test',
        author: 'james',
        date: '2026-03-03T14:30:00Z',
        resolved: false,
      };

      highlighter.highlightComment(container, comment);

      // getHighlightElement should find the first span
      const el = highlighter.getHighlightElement('comment-1');
      expect(el).not.toBeNull();
      expect(el!.classList.contains('mdview-comment-highlight')).toBe(true);

      document.body.removeChild(container);
    });
  });

  describe('removeHighlight', () => {
    it('should unwrap the highlight span', () => {
      container.innerHTML =
        '<p>The <span class="mdview-comment-highlight" data-comment-id="comment-1">brown fox</span> jumps.</p>';
      document.body.appendChild(container);

      highlighter.removeHighlight('comment-1');

      expect(container.querySelector('.mdview-comment-highlight')).toBeNull();
      expect(container.textContent).toBe('The brown fox jumps.');

      document.body.removeChild(container);
    });

    it('should unwrap multiple highlight spans from cross-node highlights', () => {
      // Simulate cross-node highlight: two spans with same comment ID
      container.innerHTML =
        '<p>Some <span class="mdview-comment-highlight" data-comment-id="comment-1">bold</span>' +
        '<span class="mdview-comment-highlight" data-comment-id="comment-1"> text</span> here.</p>';
      document.body.appendChild(container);

      highlighter.removeHighlight('comment-1');

      expect(container.querySelector('.mdview-comment-highlight')).toBeNull();
      expect(container.textContent).toBe('Some bold text here.');

      document.body.removeChild(container);
    });
  });

  describe('setActive / clearActive', () => {
    it('should toggle active class', () => {
      container.innerHTML =
        '<p><span class="mdview-comment-highlight" data-comment-id="comment-1">text</span></p>';
      document.body.appendChild(container);

      highlighter.setActive('comment-1');
      const span = container.querySelector('[data-comment-id="comment-1"]') as HTMLElement;
      expect(span.classList.contains('active')).toBe(true);

      highlighter.clearActive();
      expect(span.classList.contains('active')).toBe(false);

      document.body.removeChild(container);
    });
  });

  describe('setResolved', () => {
    it('should add resolved class', () => {
      container.innerHTML =
        '<p><span class="mdview-comment-highlight" data-comment-id="comment-1">text</span></p>';
      document.body.appendChild(container);

      highlighter.setResolved('comment-1');
      const span = container.querySelector('[data-comment-id="comment-1"]') as HTMLElement;
      expect(span.classList.contains('resolved')).toBe(true);

      document.body.removeChild(container);
    });
  });

  describe('getHighlightElement', () => {
    it('should return the highlight element', () => {
      container.innerHTML =
        '<p><span class="mdview-comment-highlight" data-comment-id="comment-1">text</span></p>';
      document.body.appendChild(container);

      const el = highlighter.getHighlightElement('comment-1');
      expect(el).not.toBeNull();
      expect(el!.textContent).toBe('text');

      document.body.removeChild(container);
    });

    it('should return null for non-existent comment', () => {
      const el = highlighter.getHighlightElement('comment-999');
      expect(el).toBeNull();
    });
  });
});

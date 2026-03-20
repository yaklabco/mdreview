/**
 * Unit tests for Comment UI
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommentUI } from '@mdview/core';
import type { Comment, CommentReply, CommentReactions } from '@mdview/core';

describe('CommentUI', () => {
  let ui: CommentUI;

  const sampleComment: Comment = {
    id: 'comment-1',
    selectedText: 'some selected text',
    body: 'This is a comment body',
    author: 'Alice',
    date: new Date().toISOString(),
    resolved: false,
  };

  const resolvedComment: Comment = {
    id: 'comment-2',
    selectedText: 'other text',
    body: 'This has been resolved',
    author: 'Bob',
    date: '2025-01-15T10:30:00Z',
    resolved: true,
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    ui = new CommentUI();
  });

  afterEach(() => {
    ui.destroy();
    vi.restoreAllMocks();
  });

  describe('createGutter', () => {
    test('should return a div with the correct class', () => {
      const gutter = ui.createGutter();

      expect(gutter).toBeDefined();
      expect(gutter.tagName).toBe('DIV');
      expect(gutter.classList.contains('mdview-comment-gutter')).toBe(true);
    });
  });

  describe('renderCard', () => {
    test('should create correct DOM structure with author, date, body, and menu button', () => {
      const card = ui.renderCard(sampleComment);

      expect(card.tagName).toBe('DIV');
      expect(card.classList.contains('mdview-comment-card')).toBe(true);
      expect(card.dataset.commentId).toBe('comment-1');

      const header = card.querySelector('.comment-header');
      expect(header).not.toBeNull();

      const author = card.querySelector('.comment-author');
      expect(author).not.toBeNull();
      expect(author?.textContent).toBe('Alice');

      const date = card.querySelector('.comment-date');
      expect(date).not.toBeNull();

      const menuBtn = card.querySelector('.comment-menu-btn');
      expect(menuBtn).not.toBeNull();

      const body = card.querySelector('.comment-body');
      expect(body).not.toBeNull();
      expect(body?.textContent).toBe('This is a comment body');
    });

    test('should render author name in bold', () => {
      const card = ui.renderCard(sampleComment);

      const author = card.querySelector('.comment-author');
      expect(author?.tagName).toBe('STRONG');
    });

    test('should display relative time for recent dates', () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const recentComment: Comment = {
        ...sampleComment,
        date: fiveMinutesAgo.toISOString(),
      };

      const card = ui.renderCard(recentComment);
      const date = card.querySelector('.comment-date');
      expect(date?.textContent).toBe('5 minutes ago');
    });

    test('should display "just now" for very recent dates', () => {
      const now = new Date();
      const tenSecondsAgo = new Date(now.getTime() - 10 * 1000);
      const recentComment: Comment = {
        ...sampleComment,
        date: tenSecondsAgo.toISOString(),
      };

      const card = ui.renderCard(recentComment);
      const date = card.querySelector('.comment-date');
      expect(date?.textContent).toBe('just now');
    });

    test('should display hours ago for dates within 24 hours', () => {
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const recentComment: Comment = {
        ...sampleComment,
        date: threeHoursAgo.toISOString(),
      };

      const card = ui.renderCard(recentComment);
      const date = card.querySelector('.comment-date');
      expect(date?.textContent).toBe('3 hours ago');
    });

    test('should display days ago for dates within 7 days', () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const recentComment: Comment = {
        ...sampleComment,
        date: twoDaysAgo.toISOString(),
      };

      const card = ui.renderCard(recentComment);
      const date = card.querySelector('.comment-date');
      expect(date?.textContent).toBe('2 days ago');
    });

    test('should display formatted date for dates older than 7 days', () => {
      const oldComment: Comment = {
        ...sampleComment,
        date: '2024-03-15T10:30:00Z',
      };

      const card = ui.renderCard(oldComment);
      const date = card.querySelector('.comment-date');
      expect(date?.textContent).toBe('Mar 15, 2024');
    });

    test('should add .resolved class and resolved badge for resolved comments', () => {
      const card = ui.renderCard(resolvedComment);

      expect(card.classList.contains('resolved')).toBe(true);

      const badge = card.querySelector('.resolved-badge');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toBe('Resolved');
    });

    test('should display "Anonymous" when author is empty', () => {
      const emptyAuthorComment: Comment = {
        ...sampleComment,
        author: '',
      };

      const card = ui.renderCard(emptyAuthorComment);
      const author = card.querySelector('.comment-author');
      expect(author?.textContent).toBe('Anonymous');
    });

    test('should not add .resolved class for unresolved comments', () => {
      const card = ui.renderCard(sampleComment);

      expect(card.classList.contains('resolved')).toBe(false);

      const badge = card.querySelector('.resolved-badge');
      expect(badge).toBeNull();
    });

    test('should render tag pills when comment has tags', () => {
      const taggedComment: Comment = {
        ...sampleComment,
        tags: ['blocking', 'suggestion'],
      };
      const card = ui.renderCard(taggedComment);

      const tagsContainer = card.querySelector('.comment-tags');
      expect(tagsContainer).not.toBeNull();

      const pills = card.querySelectorAll('.comment-tag');
      expect(pills.length).toBe(2);

      expect(pills[0].textContent).toBe('blocking');
      expect(pills[0].classList.contains('comment-tag--blocking')).toBe(true);
      expect(pills[1].textContent).toBe('suggestion');
      expect(pills[1].classList.contains('comment-tag--suggestion')).toBe(true);
    });

    test('should not render tag container when comment has no tags', () => {
      const card = ui.renderCard(sampleComment);

      const tagsContainer = card.querySelector('.comment-tags');
      expect(tagsContainer).toBeNull();
    });

    test('should not render tag container when tags array is empty', () => {
      const emptyTagsComment: Comment = {
        ...sampleComment,
        tags: [],
      };
      const card = ui.renderCard(emptyTagsComment);

      const tagsContainer = card.querySelector('.comment-tags');
      expect(tagsContainer).toBeNull();
    });

    test('should render tags between header and body', () => {
      const taggedComment: Comment = {
        ...sampleComment,
        tags: ['nit'],
      };
      const card = ui.renderCard(taggedComment);

      const children = Array.from(card.children);
      const headerIdx = children.findIndex((el) => el.classList.contains('comment-header'));
      const tagsIdx = children.findIndex((el) => el.classList.contains('comment-tags'));
      const bodyIdx = children.findIndex((el) => el.classList.contains('comment-body'));

      expect(headerIdx).toBeLessThan(tagsIdx);
      expect(tagsIdx).toBeLessThan(bodyIdx);
    });

    test('should dispatch mdview:comment:focus on card click', () => {
      const card = ui.renderCard(sampleComment);
      document.body.appendChild(card);

      const handler = vi.fn();
      document.addEventListener('mdview:comment:focus', handler);

      card.click();

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.commentId).toBe('comment-1');

      document.removeEventListener('mdview:comment:focus', handler);
    });
  });

  describe('minimized cards', () => {
    test('should render with .minimized class by default', () => {
      const card = ui.renderCard(sampleComment);

      expect(card.classList.contains('minimized')).toBe(true);
    });

    test('should have .comment-snippet with truncated body text', () => {
      const card = ui.renderCard(sampleComment);

      const snippet = card.querySelector('.comment-snippet');
      expect(snippet).not.toBeNull();
      expect(snippet?.textContent).toBe('This is a comment body');
    });

    test('should truncate snippet to ~60 chars with ellipsis for long bodies', () => {
      const longComment: Comment = {
        ...sampleComment,
        body: 'This is a very long comment body that exceeds sixty characters and should be truncated with an ellipsis at the end',
      };
      const card = ui.renderCard(longComment);

      const snippet = card.querySelector('.comment-snippet');
      expect(snippet?.textContent!.length).toBeLessThanOrEqual(63); // 60 + "..."
      expect(snippet?.textContent).toMatch(/\.\.\.$/);
    });

    test('should not add ellipsis for short bodies', () => {
      const card = ui.renderCard(sampleComment);

      const snippet = card.querySelector('.comment-snippet');
      expect(snippet?.textContent).not.toMatch(/\.\.\.$/);
    });

    test('should place snippet after header', () => {
      const card = ui.renderCard(sampleComment);

      const children = Array.from(card.children);
      const headerIdx = children.findIndex((el) => el.classList.contains('comment-header'));
      const snippetIdx = children.findIndex((el) => el.classList.contains('comment-snippet'));

      expect(snippetIdx).toBe(headerIdx + 1);
    });

    test('clicking card should remove .minimized (expand)', () => {
      const card = ui.renderCard(sampleComment);
      document.body.appendChild(card);

      expect(card.classList.contains('minimized')).toBe(true);
      card.click();
      expect(card.classList.contains('minimized')).toBe(false);
    });

    test('clicking expanded card should add .minimized (collapse)', () => {
      const card = ui.renderCard(sampleComment);
      document.body.appendChild(card);

      // Expand first
      card.click();
      expect(card.classList.contains('minimized')).toBe(false);

      // Collapse
      card.click();
      expect(card.classList.contains('minimized')).toBe(true);
    });

    test('should dispatch mdview:comment:focus only on expand', () => {
      const card = ui.renderCard(sampleComment);
      document.body.appendChild(card);

      const handler = vi.fn();
      document.addEventListener('mdview:comment:focus', handler);

      // Expand — should fire focus
      card.click();
      expect(handler).toHaveBeenCalledTimes(1);

      // Collapse — should NOT fire focus again
      card.click();
      expect(handler).toHaveBeenCalledTimes(1);

      document.removeEventListener('mdview:comment:focus', handler);
    });

    test('should dispatch mdview:comment:reposition on every toggle', () => {
      const card = ui.renderCard(sampleComment);
      document.body.appendChild(card);

      const handler = vi.fn();
      document.addEventListener('mdview:comment:reposition', handler);

      // Expand
      card.click();
      expect(handler).toHaveBeenCalledTimes(1);

      // Collapse
      card.click();
      expect(handler).toHaveBeenCalledTimes(2);

      document.removeEventListener('mdview:comment:reposition', handler);
    });
  });

  describe('overflow menu', () => {
    test('should show dropdown when menu button is clicked', () => {
      const card = ui.renderCard(sampleComment);
      document.body.appendChild(card);

      const menuBtn = card.querySelector('.comment-menu-btn') as HTMLElement;
      menuBtn.click();

      const dropdown = document.querySelector('.mdview-comment-menu');
      expect(dropdown).not.toBeNull();
      expect(dropdown?.getAttribute('role')).toBe('menu');
    });

    test('should have Edit, Resolve, and Delete items', () => {
      const card = ui.renderCard(sampleComment);
      document.body.appendChild(card);

      const menuBtn = card.querySelector('.comment-menu-btn') as HTMLElement;
      menuBtn.click();

      const items = document.querySelectorAll('.mdview-comment-menu [role="menuitem"]');
      expect(items.length).toBe(3);

      const texts = Array.from(items).map((item) => item.textContent);
      expect(texts).toContain('Edit');
      expect(texts).toContain('Resolve');
      expect(texts).toContain('Delete');
    });

    test('should dispatch mdview:comment:edit when Edit is clicked', () => {
      const card = ui.renderCard(sampleComment);
      document.body.appendChild(card);

      const handler = vi.fn();
      document.addEventListener('mdview:comment:edit', handler);

      const menuBtn = card.querySelector('.comment-menu-btn') as HTMLElement;
      menuBtn.click();

      const editItem = Array.from(
        document.querySelectorAll('.mdview-comment-menu [role="menuitem"]')
      ).find((el) => el.textContent === 'Edit') as HTMLElement;
      editItem.click();

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.commentId).toBe('comment-1');

      document.removeEventListener('mdview:comment:edit', handler);
    });

    test('should dispatch mdview:comment:resolve when Resolve is clicked', () => {
      const card = ui.renderCard(sampleComment);
      document.body.appendChild(card);

      const handler = vi.fn();
      document.addEventListener('mdview:comment:resolve', handler);

      const menuBtn = card.querySelector('.comment-menu-btn') as HTMLElement;
      menuBtn.click();

      const resolveItem = Array.from(
        document.querySelectorAll('.mdview-comment-menu [role="menuitem"]')
      ).find((el) => el.textContent === 'Resolve') as HTMLElement;
      resolveItem.click();

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.commentId).toBe('comment-1');

      document.removeEventListener('mdview:comment:resolve', handler);
    });

    test('should dispatch mdview:comment:delete when Delete is clicked', () => {
      const card = ui.renderCard(sampleComment);
      document.body.appendChild(card);

      const handler = vi.fn();
      document.addEventListener('mdview:comment:delete', handler);

      const menuBtn = card.querySelector('.comment-menu-btn') as HTMLElement;
      menuBtn.click();

      const deleteItem = Array.from(
        document.querySelectorAll('.mdview-comment-menu [role="menuitem"]')
      ).find((el) => el.textContent === 'Delete') as HTMLElement;
      deleteItem.click();

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.commentId).toBe('comment-1');

      document.removeEventListener('mdview:comment:delete', handler);
    });

    test('should close menu when clicking outside', () => {
      const card = ui.renderCard(sampleComment);
      document.body.appendChild(card);

      const menuBtn = card.querySelector('.comment-menu-btn') as HTMLElement;
      menuBtn.click();

      expect(document.querySelector('.mdview-comment-menu')).not.toBeNull();

      // Click outside the menu
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(document.querySelector('.mdview-comment-menu')).toBeNull();
    });

    test('should close previous menu when opening a new one', () => {
      const card1 = ui.renderCard(sampleComment);
      const card2 = ui.renderCard({ ...sampleComment, id: 'comment-99' });
      document.body.appendChild(card1);
      document.body.appendChild(card2);

      // Open first menu
      const menuBtn1 = card1.querySelector('.comment-menu-btn') as HTMLElement;
      menuBtn1.click();
      expect(document.querySelectorAll('.mdview-comment-menu').length).toBe(1);

      // Open second menu
      const menuBtn2 = card2.querySelector('.comment-menu-btn') as HTMLElement;
      menuBtn2.click();

      // Should still only have one menu open
      expect(document.querySelectorAll('.mdview-comment-menu').length).toBe(1);
    });
  });

  describe('renderInputForm', () => {
    test('should contain a textarea and action buttons', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const form = ui.renderInputForm(onSave, onCancel);

      expect(form.tagName).toBe('DIV');
      expect(form.classList.contains('mdview-comment-input')).toBe(true);

      const textarea = form.querySelector('textarea');
      expect(textarea).not.toBeNull();

      const buttons = form.querySelectorAll('button');
      expect(buttons.length).toBe(2);
    });

    test('should have a Save button and a Cancel button', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const form = ui.renderInputForm(onSave, onCancel);

      const buttons = form.querySelectorAll('button');
      const buttonTexts = Array.from(buttons).map((b) => b.textContent);
      expect(buttonTexts).toContain('Save');
      expect(buttonTexts).toContain('Cancel');
    });

    test('should call onSave with textarea value when Save is clicked', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const form = ui.renderInputForm(onSave, onCancel);
      document.body.appendChild(form);

      const textarea = form.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'My comment text';

      const saveBtn = Array.from(form.querySelectorAll('button')).find(
        (b) => b.textContent === 'Save'
      ) as HTMLButtonElement;
      saveBtn.click();

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith('My comment text', []);
    });

    test('should call onCancel when Cancel is clicked', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const form = ui.renderInputForm(onSave, onCancel);
      document.body.appendChild(form);

      const cancelBtn = Array.from(form.querySelectorAll('button')).find(
        (b) => b.textContent === 'Cancel'
      ) as HTMLButtonElement;
      cancelBtn.click();

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    test('should trigger save on Cmd+Enter in textarea', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const form = ui.renderInputForm(onSave, onCancel);
      document.body.appendChild(form);

      const textarea = form.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'Keyboard shortcut comment';

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        metaKey: true,
        bubbles: true,
      });
      textarea.dispatchEvent(event);

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith('Keyboard shortcut comment', []);
    });

    test('should trigger save on Ctrl+Enter in textarea', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const form = ui.renderInputForm(onSave, onCancel);
      document.body.appendChild(form);

      const textarea = form.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'Ctrl enter comment';

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
      });
      textarea.dispatchEvent(event);

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith('Ctrl enter comment', []);
    });

    test('should not trigger save on plain Enter in textarea', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const form = ui.renderInputForm(onSave, onCancel);
      document.body.appendChild(form);

      const textarea = form.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'should not save';

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      });
      textarea.dispatchEvent(event);

      expect(onSave).not.toHaveBeenCalled();
    });

    test('should include tag picker with all tag options', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const form = ui.renderInputForm(onSave, onCancel);

      const picker = form.querySelector('.comment-tag-picker');
      expect(picker).not.toBeNull();

      const tagPills = form.querySelectorAll('.comment-tag-picker .comment-tag-option');
      const tagNames = Array.from(tagPills).map((p) => p.textContent);
      expect(tagNames).toEqual([
        'blocking',
        'nit',
        'suggestion',
        'question',
        'praise',
        'todo',
        'fyi',
      ]);
    });

    test('should toggle .active class on tag pill click', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const form = ui.renderInputForm(onSave, onCancel);
      document.body.appendChild(form);

      const pills = form.querySelectorAll('.comment-tag-option');
      const blockingPill = pills[0] as HTMLElement;

      expect(blockingPill.classList.contains('active')).toBe(false);

      blockingPill.click();
      expect(blockingPill.classList.contains('active')).toBe(true);

      blockingPill.click();
      expect(blockingPill.classList.contains('active')).toBe(false);
    });

    test('should pass selected tags to onSave callback', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const form = ui.renderInputForm(onSave, onCancel);
      document.body.appendChild(form);

      const textarea = form.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'My comment';

      // Select "blocking" and "suggestion"
      const pills = form.querySelectorAll('.comment-tag-option');
      (pills[0] as HTMLElement).click(); // blocking
      (pills[2] as HTMLElement).click(); // suggestion

      const saveBtn = form.querySelector('.mdview-comment-btn-save') as HTMLElement;
      saveBtn.click();

      expect(onSave).toHaveBeenCalledWith('My comment', ['blocking', 'suggestion']);
    });

    test('should pass empty tags array when no tags selected', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const form = ui.renderInputForm(onSave, onCancel);
      document.body.appendChild(form);

      const textarea = form.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'No tags comment';

      const saveBtn = form.querySelector('.mdview-comment-btn-save') as HTMLElement;
      saveBtn.click();

      expect(onSave).toHaveBeenCalledWith('No tags comment', []);
    });

    test('should pass tags on Cmd+Enter keyboard shortcut', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const form = ui.renderInputForm(onSave, onCancel);
      document.body.appendChild(form);

      const textarea = form.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'Keyboard save';

      // Select "nit"
      const pills = form.querySelectorAll('.comment-tag-option');
      (pills[1] as HTMLElement).click(); // nit

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        metaKey: true,
        bubbles: true,
      });
      textarea.dispatchEvent(event);

      expect(onSave).toHaveBeenCalledWith('Keyboard save', ['nit']);
    });

    test('should render tag picker between textarea and actions', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const form = ui.renderInputForm(onSave, onCancel);

      const children = Array.from(form.children);
      const textareaIdx = children.findIndex((el) => el.tagName === 'TEXTAREA');
      const pickerIdx = children.findIndex((el) => el.classList.contains('comment-tag-picker'));
      const actionsIdx = children.findIndex((el) =>
        el.classList.contains('mdview-comment-input-actions')
      );

      expect(textareaIdx).toBeLessThan(pickerIdx);
      expect(pickerIdx).toBeLessThan(actionsIdx);
    });

    test('should pre-select tags when initialTags provided', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const form = ui.renderInputForm(onSave, onCancel, ['blocking', 'nit']);
      document.body.appendChild(form);

      const activePills = form.querySelectorAll('.comment-tag-option.active');
      const activeNames = Array.from(activePills).map((p) => p.textContent);
      expect(activeNames).toContain('blocking');
      expect(activeNames).toContain('nit');
      expect(activePills.length).toBe(2);
    });
  });

  describe('showToast', () => {
    test('should create a toast element', () => {
      vi.useFakeTimers();

      ui.showToast('Comment saved');

      const toast = document.querySelector('.mdview-toast');
      expect(toast).not.toBeNull();
      expect(toast?.textContent).toBe('Comment saved');

      vi.useRealTimers();
    });

    test('should add visible class after a frame', () => {
      vi.useFakeTimers();

      ui.showToast('Comment saved');

      // Before frame callback runs
      const toast = document.querySelector('.mdview-toast');
      expect(toast?.classList.contains('visible')).toBe(false);

      // requestAnimationFrame fires
      vi.advanceTimersByTime(16);

      expect(toast?.classList.contains('visible')).toBe(true);

      vi.useRealTimers();
    });

    test('should remove toast after duration', () => {
      vi.useFakeTimers();

      ui.showToast('Temporary toast', 1000);

      vi.advanceTimersByTime(16); // frame
      vi.advanceTimersByTime(1000); // duration

      const toast = document.querySelector('.mdview-toast');
      expect(toast).toBeNull();

      vi.useRealTimers();
    });

    test('should default to 2000ms duration', () => {
      vi.useFakeTimers();

      ui.showToast('Default duration toast');

      vi.advanceTimersByTime(16); // frame

      // Still visible at 1500ms
      vi.advanceTimersByTime(1500);
      expect(document.querySelector('.mdview-toast')).not.toBeNull();

      // Gone at 2000ms
      vi.advanceTimersByTime(500);
      expect(document.querySelector('.mdview-toast')).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('destroy', () => {
    test('should remove gutter from DOM', () => {
      const gutter = ui.createGutter();
      document.body.appendChild(gutter);

      expect(document.querySelector('.mdview-comment-gutter')).not.toBeNull();

      ui.destroy();

      expect(document.querySelector('.mdview-comment-gutter')).toBeNull();
    });

    test('should remove cards from DOM', () => {
      const gutter = ui.createGutter();
      document.body.appendChild(gutter);

      const card = ui.renderCard(sampleComment);
      gutter.appendChild(card);

      expect(document.querySelector('.mdview-comment-card')).not.toBeNull();

      ui.destroy();

      expect(document.querySelector('.mdview-comment-card')).toBeNull();
    });

    test('should clean up click-outside listener', () => {
      const card = ui.renderCard(sampleComment);
      document.body.appendChild(card);

      // Open a menu
      const menuBtn = card.querySelector('.comment-menu-btn') as HTMLElement;
      menuBtn.click();

      ui.destroy();

      // Should not throw when clicking after destroy
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  });

  describe('replies rendering in cards', () => {
    const sampleReplies: CommentReply[] = [
      { id: 'reply-1', author: 'Bob', body: 'Good catch', date: '2026-03-04T10:00:00Z' },
      { id: 'reply-2', author: 'Carol', body: 'Agreed', date: '2026-03-04T11:00:00Z' },
    ];

    test('should render replies section when comment has replies', () => {
      const commentWithReplies: Comment = {
        ...sampleComment,
        replies: sampleReplies,
      };
      const card = ui.renderCard(commentWithReplies);

      const repliesSection = card.querySelector('.comment-replies');
      expect(repliesSection).not.toBeNull();

      const replies = card.querySelectorAll('.comment-reply');
      expect(replies.length).toBe(2);
    });

    test('should not render replies section when no replies', () => {
      const card = ui.renderCard(sampleComment);

      const repliesSection = card.querySelector('.comment-replies');
      expect(repliesSection).toBeNull();
    });

    test('should not render replies section when replies is empty', () => {
      const commentEmptyReplies: Comment = {
        ...sampleComment,
        replies: [],
      };
      const card = ui.renderCard(commentEmptyReplies);

      const repliesSection = card.querySelector('.comment-replies');
      expect(repliesSection).toBeNull();
    });

    test('should render reply author and body', () => {
      const commentWithReplies: Comment = {
        ...sampleComment,
        replies: [sampleReplies[0]],
      };
      const card = ui.renderCard(commentWithReplies);

      const reply = card.querySelector('.comment-reply');
      expect(reply).not.toBeNull();
      expect(reply?.querySelector('.comment-reply-author')?.textContent).toBe('Bob');
      expect(reply?.querySelector('.comment-reply-body')?.textContent).toBe('Good catch');
    });

    test('should render reply button on non-resolved cards', () => {
      const card = ui.renderCard(sampleComment);
      const replyBtn = card.querySelector('.comment-reply-btn');
      expect(replyBtn).not.toBeNull();
      expect(replyBtn?.textContent).toBe('Reply');
    });

    test('should not render reply button on resolved cards', () => {
      const card = ui.renderCard(resolvedComment);
      const replyBtn = card.querySelector('.comment-reply-btn');
      expect(replyBtn).toBeNull();
    });

    test('should dispatch mdview:comment:reply when reply button clicked', () => {
      const card = ui.renderCard(sampleComment);
      document.body.appendChild(card);

      const handler = vi.fn();
      document.addEventListener('mdview:comment:reply', handler);

      const replyBtn = card.querySelector('.comment-reply-btn') as HTMLElement;
      replyBtn.click();

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.commentId).toBe('comment-1');

      document.removeEventListener('mdview:comment:reply', handler);
    });

    test('should render replies between body and reactions', () => {
      const commentWithReplies: Comment = {
        ...sampleComment,
        replies: sampleReplies,
        reactions: { '\u{1F44D}': ['bob'] },
      };
      ui.setCurrentAuthor('test');
      const card = ui.renderCard(commentWithReplies);

      const children = Array.from(card.children);
      const bodyIdx = children.findIndex((el) => el.classList.contains('comment-body'));
      const repliesIdx = children.findIndex((el) => el.classList.contains('comment-replies'));
      const reactionsIdx = children.findIndex((el) => el.classList.contains('comment-reactions'));

      expect(bodyIdx).toBeLessThan(repliesIdx);
      expect(repliesIdx).toBeLessThan(reactionsIdx);
    });
  });

  describe('renderReplyForm', () => {
    test('should render compact form with textarea and buttons', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const form = ui.renderReplyForm(onSave, onCancel);

      expect(form.classList.contains('comment-reply-form')).toBe(true);
      expect(form.querySelector('textarea')).not.toBeNull();

      const textarea = form.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea.rows).toBe(2);

      const buttons = form.querySelectorAll('button');
      expect(buttons.length).toBe(2);
    });

    test('should not contain tag picker', () => {
      const form = ui.renderReplyForm(vi.fn(), vi.fn());
      expect(form.querySelector('.comment-tag-picker')).toBeNull();
    });

    test('should call onSave with text when Save clicked', () => {
      const onSave = vi.fn();
      const form = ui.renderReplyForm(onSave, vi.fn());
      document.body.appendChild(form);

      const textarea = form.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'My reply';

      const saveBtn = form.querySelector('.mdview-comment-btn-save') as HTMLElement;
      saveBtn.click();

      expect(onSave).toHaveBeenCalledWith('My reply');
    });

    test('should call onCancel when Cancel clicked', () => {
      const onCancel = vi.fn();
      const form = ui.renderReplyForm(vi.fn(), onCancel);
      document.body.appendChild(form);

      const cancelBtn = form.querySelector('.mdview-comment-btn-cancel') as HTMLElement;
      cancelBtn.click();

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    test('should support Cmd+Enter to save', () => {
      const onSave = vi.fn();
      const form = ui.renderReplyForm(onSave, vi.fn());
      document.body.appendChild(form);

      const textarea = form.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'Keyboard reply';

      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          metaKey: true,
          bubbles: true,
        })
      );

      expect(onSave).toHaveBeenCalledWith('Keyboard reply');
    });
  });

  describe('reactions rendering', () => {
    const sampleReactions: CommentReactions = {
      '\u{1F44D}': ['bob', 'carol'],
      '\u{2764}\u{FE0F}': ['alice'],
    };

    test('should render reaction pills when comment has reactions', () => {
      ui.setCurrentAuthor('test');
      const commentWithReactions: Comment = {
        ...sampleComment,
        reactions: sampleReactions,
      };
      const card = ui.renderCard(commentWithReactions);

      const reactionsSection = card.querySelector('.comment-reactions');
      expect(reactionsSection).not.toBeNull();

      const pills = card.querySelectorAll('.comment-reaction');
      expect(pills.length).toBe(2);
    });

    test('should render emoji char and count on pills', () => {
      ui.setCurrentAuthor('test');
      const commentWithReactions: Comment = {
        ...sampleComment,
        reactions: sampleReactions,
      };
      const card = ui.renderCard(commentWithReactions);

      const pills = card.querySelectorAll('.comment-reaction');
      expect(pills[0].textContent).toContain('\u{1F44D}');
      expect(pills[0].textContent).toContain('2');
      expect(pills[1].textContent).toContain('\u{2764}\u{FE0F}');
      expect(pills[1].textContent).toContain('1');
    });

    test('should add .mine class when current author has reacted', () => {
      ui.setCurrentAuthor('bob');
      const commentWithReactions: Comment = {
        ...sampleComment,
        reactions: sampleReactions,
      };
      const card = ui.renderCard(commentWithReactions);

      const pills = card.querySelectorAll('.comment-reaction');
      // bob reacted with 👍
      expect(pills[0].classList.contains('mine')).toBe(true);
      // bob did not react with ❤️
      expect(pills[1].classList.contains('mine')).toBe(false);
    });

    test('should render "+" add reaction button', () => {
      ui.setCurrentAuthor('test');
      const card = ui.renderCard(sampleComment);

      const addBtn = card.querySelector('.comment-reaction-add');
      expect(addBtn).not.toBeNull();
      expect(addBtn?.textContent).toBe('+');
    });

    test('should dispatch mdview:comment:react when clicking a reaction pill', () => {
      ui.setCurrentAuthor('test');
      const commentWithReactions: Comment = {
        ...sampleComment,
        reactions: sampleReactions,
      };
      const card = ui.renderCard(commentWithReactions);
      document.body.appendChild(card);

      const handler = vi.fn();
      document.addEventListener('mdview:comment:react', handler);

      const pill = card.querySelector('.comment-reaction') as HTMLElement;
      pill.click();

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.commentId).toBe('comment-1');
      expect(event.detail.emoji).toBe('\u{1F44D}');

      document.removeEventListener('mdview:comment:react', handler);
    });

    test('should dispatch mdview:comment:react:picker when clicking "+" button', () => {
      ui.setCurrentAuthor('test');
      const card = ui.renderCard(sampleComment);
      document.body.appendChild(card);

      const handler = vi.fn();
      document.addEventListener('mdview:comment:react:picker', handler);

      const addBtn = card.querySelector('.comment-reaction-add') as HTMLElement;
      addBtn.click();

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.commentId).toBe('comment-1');

      document.removeEventListener('mdview:comment:react:picker', handler);
    });

    test('should not render reactions section when no reactions and no author set', () => {
      const card = ui.renderCard(sampleComment);
      const reactionsSection = card.querySelector('.comment-reactions');
      // Should still show the "+" button area when author is set
      expect(reactionsSection).toBeNull();
    });
  });

  describe('emoji picker', () => {
    test('should render quick palette with 12 emojis', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      const anchor = document.createElement('div');
      document.body.appendChild(anchor);

      const picker = ui.renderEmojiPicker(anchor, onSelect, onClose);
      document.body.appendChild(picker);

      const quickRow = picker.querySelector('.emoji-picker-quick');
      expect(quickRow).not.toBeNull();

      const quickEmojis = quickRow!.querySelectorAll('button');
      expect(quickEmojis.length).toBe(12);
    });

    test('should render search input', () => {
      const picker = ui.renderEmojiPicker(document.createElement('div'), vi.fn(), vi.fn());

      const searchInput = picker.querySelector('.emoji-picker-search');
      expect(searchInput).not.toBeNull();
      expect(searchInput?.tagName).toBe('INPUT');
    });

    test('should render categorized grid', () => {
      const picker = ui.renderEmojiPicker(document.createElement('div'), vi.fn(), vi.fn());

      const grid = picker.querySelector('.emoji-picker-grid');
      expect(grid).not.toBeNull();

      // Should have category headers
      const headers = grid!.querySelectorAll('.emoji-picker-category-name');
      expect(headers.length).toBe(8);
    });

    test('should call onSelect with emoji char when clicked', () => {
      const onSelect = vi.fn();
      const picker = ui.renderEmojiPicker(document.createElement('div'), onSelect, vi.fn());
      document.body.appendChild(picker);

      const firstQuickEmoji = picker.querySelector('.emoji-picker-quick button') as HTMLElement;
      firstQuickEmoji.click();

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(typeof onSelect.mock.calls[0][0]).toBe('string');
    });

    test('should have correct class name', () => {
      const picker = ui.renderEmojiPicker(document.createElement('div'), vi.fn(), vi.fn());

      expect(picker.classList.contains('mdview-emoji-picker')).toBe(true);
    });

    test('should call onClose when clicking outside the picker', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      const anchor = document.createElement('div');
      document.body.appendChild(anchor);

      const picker = ui.renderEmojiPicker(anchor, onSelect, onClose);
      document.body.appendChild(picker);

      // Click outside the picker
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('should not call onClose when clicking inside the picker', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      const anchor = document.createElement('div');
      document.body.appendChild(anchor);

      const picker = ui.renderEmojiPicker(anchor, onSelect, onClose);
      document.body.appendChild(picker);

      // Click inside the picker (on the search input)
      const searchInput = picker.querySelector('.emoji-picker-search') as HTMLElement;
      searchInput.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onClose).not.toHaveBeenCalled();
    });

    test('should remove click-outside listener after close', () => {
      const onClose = vi.fn();
      const anchor = document.createElement('div');
      document.body.appendChild(anchor);

      const picker = ui.renderEmojiPicker(anchor, vi.fn(), onClose);
      document.body.appendChild(picker);

      // First click outside dismisses
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onClose).toHaveBeenCalledTimes(1);

      // Second click outside should not fire again (listener removed)
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('setCurrentAuthor', () => {
    test('should affect reaction pill .mine class', () => {
      // First set no author - should have no .mine
      ui.setCurrentAuthor('');
      const commentWithReactions: Comment = {
        ...sampleComment,
        reactions: { '\u{1F44D}': ['alice'] },
      };
      const card1 = ui.renderCard(commentWithReactions);
      const pills1 = card1.querySelectorAll('.comment-reaction.mine');
      expect(pills1.length).toBe(0);

      // Now set author to alice
      ui.setCurrentAuthor('alice');
      const card2 = ui.renderCard(commentWithReactions);
      const pills2 = card2.querySelectorAll('.comment-reaction.mine');
      expect(pills2.length).toBe(1);
    });
  });
});

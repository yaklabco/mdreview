/**
 * Unit tests for Comment UI
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommentUI } from '../../../src/comments/comment-ui';
import type { Comment } from '../../../src/types';

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

    test('should not add .resolved class for unresolved comments', () => {
      const card = ui.renderCard(sampleComment);

      expect(card.classList.contains('resolved')).toBe(false);

      const badge = card.querySelector('.resolved-badge');
      expect(badge).toBeNull();
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
      expect(onSave).toHaveBeenCalledWith('My comment text');
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
      expect(onSave).toHaveBeenCalledWith('Keyboard shortcut comment');
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
      expect(onSave).toHaveBeenCalledWith('Ctrl enter comment');
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
});

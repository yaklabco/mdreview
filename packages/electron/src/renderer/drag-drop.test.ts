import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupDragAndDrop } from './drag-drop';

describe('setupDragAndDrop', () => {
  let target: HTMLElement;
  let onFilesDropped: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    target = document.createElement('div');
    document.body.appendChild(target);
    onFilesDropped = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should prevent default on dragover', () => {
    setupDragAndDrop({ target, onFilesDropped });

    const event = new Event('dragover', { bubbles: true, cancelable: true });
    const spy = vi.spyOn(event, 'preventDefault');
    target.dispatchEvent(event);

    expect(spy).toHaveBeenCalled();
  });

  it('should add drag indicator class on dragover', () => {
    setupDragAndDrop({ target, onFilesDropped });

    const event = new Event('dragover', { bubbles: true, cancelable: true });
    target.dispatchEvent(event);

    expect(target.classList.contains('mdreview-drag-over')).toBe(true);
  });

  it('should remove indicator class on dragleave', () => {
    setupDragAndDrop({ target, onFilesDropped });

    // First add the class via dragover
    const dragoverEvent = new Event('dragover', { bubbles: true, cancelable: true });
    target.dispatchEvent(dragoverEvent);
    expect(target.classList.contains('mdreview-drag-over')).toBe(true);

    // Then remove via dragleave
    const dragleaveEvent = new Event('dragleave', { bubbles: true, cancelable: true });
    target.dispatchEvent(dragleaveEvent);

    expect(target.classList.contains('mdreview-drag-over')).toBe(false);
  });

  it('should extract .md file paths from drop event and call callback', () => {
    setupDragAndDrop({ target, onFilesDropped });

    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        files: [{ name: 'readme.md', path: '/tmp/readme.md' }],
      },
    });
    target.dispatchEvent(event);

    expect(onFilesDropped).toHaveBeenCalledWith(['/tmp/readme.md']);
  });

  it('should filter out non-.md files', () => {
    setupDragAndDrop({ target, onFilesDropped });

    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        files: [
          { name: 'readme.md', path: '/tmp/readme.md' },
          { name: 'image.png', path: '/tmp/image.png' },
          { name: 'style.css', path: '/tmp/style.css' },
          { name: 'notes.markdown', path: '/tmp/notes.markdown' },
          { name: 'doc.mdown', path: '/tmp/doc.mdown' },
          { name: 'file.mkd', path: '/tmp/file.mkd' },
          { name: 'file.mkdn', path: '/tmp/file.mkdn' },
          { name: 'component.mdx', path: '/tmp/component.mdx' },
          { name: 'data.json', path: '/tmp/data.json' },
        ],
      },
    });
    target.dispatchEvent(event);

    expect(onFilesDropped).toHaveBeenCalledWith([
      '/tmp/readme.md',
      '/tmp/notes.markdown',
      '/tmp/doc.mdown',
      '/tmp/file.mkd',
      '/tmp/file.mkdn',
      '/tmp/component.mdx',
    ]);
  });

  it('should handle multiple files in a single drop', () => {
    setupDragAndDrop({ target, onFilesDropped });

    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        files: [
          { name: 'a.md', path: '/tmp/a.md' },
          { name: 'b.md', path: '/tmp/b.md' },
          { name: 'c.md', path: '/tmp/c.md' },
        ],
      },
    });
    target.dispatchEvent(event);

    expect(onFilesDropped).toHaveBeenCalledWith(['/tmp/a.md', '/tmp/b.md', '/tmp/c.md']);
  });

  it('should remove indicator on drop', () => {
    setupDragAndDrop({ target, onFilesDropped });

    // First add the class
    const dragoverEvent = new Event('dragover', { bubbles: true, cancelable: true });
    target.dispatchEvent(dragoverEvent);
    expect(target.classList.contains('mdreview-drag-over')).toBe(true);

    // Drop should remove it
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        files: [{ name: 'test.md', path: '/tmp/test.md' }],
      },
    });
    target.dispatchEvent(dropEvent);

    expect(target.classList.contains('mdreview-drag-over')).toBe(false);
  });

  it('should return a cleanup function', () => {
    const cleanup = setupDragAndDrop({ target, onFilesDropped });

    cleanup();

    // After cleanup, events should no longer be handled
    const event = new Event('dragover', { bubbles: true, cancelable: true });
    const spy = vi.spyOn(event, 'preventDefault');
    target.dispatchEvent(event);

    expect(spy).not.toHaveBeenCalled();
    expect(target.classList.contains('mdreview-drag-over')).toBe(false);

    // Drop should also not fire callback
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        files: [{ name: 'test.md', path: '/tmp/test.md' }],
      },
    });
    target.dispatchEvent(dropEvent);

    expect(onFilesDropped).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SidebarResizeHandle } from './sidebar-resize';

describe('SidebarResizeHandle', () => {
  let workspace: HTMLElement;
  let sidebar: HTMLElement;
  let main: HTMLElement;
  let handle: SidebarResizeHandle;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="mdview-workspace">
        <div id="mdview-sidebar" style="width: 250px;"></div>
        <div id="mdview-main"></div>
      </div>
    `;
    workspace = document.getElementById('mdview-workspace')!;
    sidebar = document.getElementById('mdview-sidebar')!;
    main = document.getElementById('mdview-main')!;
    handle = new SidebarResizeHandle(sidebar);
  });

  afterEach(() => {
    handle.dispose();
  });

  it('should create handle element with correct class', () => {
    handle.render(workspace);

    const el = workspace.querySelector('.sidebar-resize-handle');
    expect(el).not.toBeNull();
    expect(el?.tagName).toBe('DIV');
  });

  it('should insert handle between sidebar and main', () => {
    handle.render(workspace);

    const children = Array.from(workspace.children);
    const sidebarIndex = children.indexOf(sidebar);
    const handleEl = workspace.querySelector('.sidebar-resize-handle')!;
    const handleIndex = children.indexOf(handleEl);
    const mainIndex = children.indexOf(main);

    expect(handleIndex).toBe(sidebarIndex + 1);
    expect(mainIndex).toBe(handleIndex + 1);
  });

  it('should update sidebar width on mousedown + mousemove', () => {
    handle.render(workspace);
    const handleEl = workspace.querySelector('.sidebar-resize-handle') as HTMLElement;

    handleEl.dispatchEvent(new MouseEvent('mousedown', { clientX: 250, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, bubbles: true }));

    expect(sidebar.style.width).toBe('300px');
  });

  it('should clamp width to minimum of 150px', () => {
    handle.render(workspace);
    const handleEl = workspace.querySelector('.sidebar-resize-handle') as HTMLElement;

    handleEl.dispatchEvent(new MouseEvent('mousedown', { clientX: 250, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, bubbles: true }));

    expect(sidebar.style.width).toBe('150px');
  });

  it('should clamp width to maximum of 500px', () => {
    handle.render(workspace);
    const handleEl = workspace.querySelector('.sidebar-resize-handle') as HTMLElement;

    handleEl.dispatchEvent(new MouseEvent('mousedown', { clientX: 250, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 600, bubbles: true }));

    expect(sidebar.style.width).toBe('500px');
  });

  it('should fire onResize callback on mouseup with final width', () => {
    const onResize = vi.fn();
    handle.onResize = onResize;
    handle.render(workspace);
    const handleEl = workspace.querySelector('.sidebar-resize-handle') as HTMLElement;

    handleEl.dispatchEvent(new MouseEvent('mousedown', { clientX: 250, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(onResize).toHaveBeenCalledWith(350);
  });

  it('should reset to default 250px on double-click', () => {
    sidebar.style.width = '400px';
    const onResize = vi.fn();
    handle.onResize = onResize;
    handle.render(workspace);
    const handleEl = workspace.querySelector('.sidebar-resize-handle') as HTMLElement;

    handleEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(sidebar.style.width).toBe('250px');
    expect(onResize).toHaveBeenCalledWith(250);
  });

  it('should remove the handle element on dispose', () => {
    handle.render(workspace);

    expect(workspace.querySelector('.sidebar-resize-handle')).not.toBeNull();

    handle.dispose();

    expect(workspace.querySelector('.sidebar-resize-handle')).toBeNull();
  });

  it('should remove event listeners on dispose', () => {
    const onResize = vi.fn();
    handle.onResize = onResize;
    handle.render(workspace);
    const handleEl = workspace.querySelector('.sidebar-resize-handle') as HTMLElement;

    handle.dispose();

    // After dispose, mousedown + mousemove should not update sidebar
    handleEl.dispatchEvent(new MouseEvent('mousedown', { clientX: 250, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    // Width should not have changed (still 250px from initial)
    expect(sidebar.style.width).toBe('250px');
    expect(onResize).not.toHaveBeenCalled();
  });

  it('should add dragging class during drag', () => {
    handle.render(workspace);
    const handleEl = workspace.querySelector('.sidebar-resize-handle') as HTMLElement;

    expect(handleEl.classList.contains('dragging')).toBe(false);

    handleEl.dispatchEvent(new MouseEvent('mousedown', { clientX: 250, bubbles: true }));
    expect(handleEl.classList.contains('dragging')).toBe(true);

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(handleEl.classList.contains('dragging')).toBe(false);
  });
});

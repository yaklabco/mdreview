import { describe, it, expect, beforeEach } from 'vitest';

describe('Workspace CSS class structure', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="mdview-workspace">
        <div id="mdview-sidebar">
          <div class="file-tree">
            <div class="file-tree-item file-tree-directory">
              <div class="file-tree-children">
                <div class="file-tree-item file-tree-file active">readme.md</div>
              </div>
            </div>
          </div>
        </div>
        <div id="mdview-main">
          <div id="mdview-toolbar-row">
            <div id="mdview-tab-bar">
              <button class="tab-button active">
                <span class="tab-title">readme.md</span>
                <span class="tab-close">&times;</span>
              </button>
              <button class="tab-button">
                <span class="tab-title">notes.md</span>
                <span class="tab-close">&times;</span>
              </button>
            </div>
            <div id="mdview-header-bar"></div>
          </div>
          <div id="mdview-content-area">
            <div class="mdview-tab-content"></div>
          </div>
          <div id="mdview-status-bar">
            <div class="status-bar-content">readme.md · 100 words</div>
          </div>
        </div>
      </div>
    `;
  });

  it('should have workspace root element', () => {
    const workspace = document.getElementById('mdview-workspace');
    expect(workspace).not.toBeNull();
  });

  it('should have sidebar element', () => {
    const sidebar = document.getElementById('mdview-sidebar');
    expect(sidebar).not.toBeNull();
  });

  it('should have tab bar with correct button classes', () => {
    const tabBar = document.getElementById('mdview-tab-bar');
    expect(tabBar).not.toBeNull();

    const tabs = tabBar!.querySelectorAll('.tab-button');
    expect(tabs).toHaveLength(2);

    const activeTab = tabBar!.querySelector('.tab-button.active');
    expect(activeTab).not.toBeNull();

    const closeButtons = tabBar!.querySelectorAll('.tab-close');
    expect(closeButtons).toHaveLength(2);
  });

  it('should have file tree with correct structure', () => {
    const fileTree = document.querySelector('.file-tree');
    expect(fileTree).not.toBeNull();

    const items = document.querySelectorAll('.file-tree-item');
    expect(items.length).toBeGreaterThan(0);

    const directory = document.querySelector('.file-tree-directory');
    expect(directory).not.toBeNull();

    const file = document.querySelector('.file-tree-file');
    expect(file).not.toBeNull();

    const activeFile = document.querySelector('.file-tree-file.active');
    expect(activeFile).not.toBeNull();

    const children = document.querySelector('.file-tree-children');
    expect(children).not.toBeNull();
  });

  it('should have status bar with content element', () => {
    const statusBar = document.getElementById('mdview-status-bar');
    expect(statusBar).not.toBeNull();

    const content = statusBar!.querySelector('.status-bar-content');
    expect(content).not.toBeNull();
  });

  it('should have content area with tab content', () => {
    const contentArea = document.getElementById('mdview-content-area');
    expect(contentArea).not.toBeNull();

    const tabContent = contentArea!.querySelector('.mdview-tab-content');
    expect(tabContent).not.toBeNull();
  });

  it('should support empty state element', () => {
    const contentArea = document.getElementById('mdview-content-area');
    const emptyState = document.createElement('div');
    emptyState.id = 'mdview-empty-state';
    emptyState.innerHTML =
      '<div class="empty-state-content"><button class="empty-state-btn">Open</button></div>';
    contentArea!.appendChild(emptyState);

    expect(document.getElementById('mdview-empty-state')).not.toBeNull();
    expect(document.querySelector('.empty-state-content')).not.toBeNull();
    expect(document.querySelector('.empty-state-btn')).not.toBeNull();
  });

  it('should support drag-over class on workspace', () => {
    const workspace = document.getElementById('mdview-workspace')!;
    workspace.classList.add('mdview-drag-over');
    expect(workspace.classList.contains('mdview-drag-over')).toBe(true);
    workspace.classList.remove('mdview-drag-over');
    expect(workspace.classList.contains('mdview-drag-over')).toBe(false);
  });
});

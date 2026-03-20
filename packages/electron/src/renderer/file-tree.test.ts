import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileTree } from './file-tree';
import type { DirectoryEntry } from '../shared/workspace-types';

function createEntries(): DirectoryEntry[] {
  return [
    {
      name: 'docs',
      path: '/project/docs',
      type: 'directory',
      children: [
        { name: 'api.md', path: '/project/docs/api.md', type: 'file' },
        { name: 'guide.md', path: '/project/docs/guide.md', type: 'file' },
      ],
    },
    { name: 'readme.md', path: '/project/readme.md', type: 'file' },
  ];
}

describe('FileTree', () => {
  let fileTree: FileTree;
  let parent: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="sidebar"></div>';
    parent = document.getElementById('sidebar')!;
    fileTree = new FileTree();
  });

  it('should render into parent element', () => {
    fileTree.render(parent);

    const container = parent.querySelector('.file-tree');
    expect(container).not.toBeNull();
  });

  it('should display directory entries as tree', () => {
    fileTree.render(parent);
    fileTree.loadDirectory(createEntries());

    const items = parent.querySelectorAll('.file-tree-item');
    // docs dir + 2 children + readme.md = 4 items
    expect(items.length).toBe(4);
  });

  it('should expand and collapse directories on click', () => {
    fileTree.render(parent);
    fileTree.loadDirectory(createEntries());

    const dirItem = parent.querySelector('.file-tree-directory') as HTMLElement;
    expect(dirItem).not.toBeNull();

    // Initially expanded
    const childContainer = dirItem
      .closest('.file-tree-item')!
      .querySelector('.file-tree-children') as HTMLElement;
    expect(childContainer.style.display).not.toBe('none');

    // Click to collapse
    dirItem.click();
    expect(childContainer.style.display).toBe('none');

    // Click to expand
    dirItem.click();
    expect(childContainer.style.display).not.toBe('none');
  });

  it('should call onFileSelected when clicking a file', () => {
    const callback = vi.fn();
    fileTree.render(parent);
    fileTree.onFileSelected(callback);
    fileTree.loadDirectory(createEntries());

    const fileItems = parent.querySelectorAll('.file-tree-file');
    expect(fileItems.length).toBeGreaterThan(0);

    (fileItems[0] as HTMLElement).click();
    expect(callback).toHaveBeenCalledWith('/project/docs/api.md');
  });

  it('should toggle visibility', () => {
    fileTree.render(parent);

    const container = parent.querySelector('.file-tree') as HTMLElement;
    expect(container.style.display).not.toBe('none');

    fileTree.setVisible(false);
    expect(container.style.display).toBe('none');

    fileTree.setVisible(true);
    expect(container.style.display).not.toBe('none');
  });

  it('should refresh with new entries', () => {
    fileTree.render(parent);
    fileTree.loadDirectory(createEntries());

    const newEntries: DirectoryEntry[] = [
      { name: 'changelog.md', path: '/project/changelog.md', type: 'file' },
    ];
    fileTree.refresh(newEntries);

    const items = parent.querySelectorAll('.file-tree-item');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('changelog.md');
  });

  it('should handle empty entries', () => {
    fileTree.render(parent);
    fileTree.loadDirectory([]);

    const items = parent.querySelectorAll('.file-tree-item');
    expect(items.length).toBe(0);
  });

  it('should show directories before files', () => {
    fileTree.render(parent);
    fileTree.loadDirectory(createEntries());

    // Get top-level items only (depth 0)
    const topLevel = parent.querySelector('.file-tree-list')!.children;
    const topLevelItems = Array.from(topLevel);

    // First should be docs directory, second should be readme.md file
    expect(topLevelItems[0].querySelector('.file-tree-directory')).not.toBeNull();
    expect(topLevelItems[1].querySelector('.file-tree-file')).not.toBeNull();
  });

  it('should mark active file', () => {
    fileTree.render(parent);
    fileTree.loadDirectory(createEntries());

    fileTree.setActiveFile('/project/docs/api.md');

    const activeItems = parent.querySelectorAll('.file-tree-file.active');
    expect(activeItems.length).toBe(1);
    expect((activeItems[0] as HTMLElement).dataset.path).toBe('/project/docs/api.md');
  });

  it('should dispose cleanly', () => {
    fileTree.render(parent);
    fileTree.loadDirectory(createEntries());

    fileTree.dispose();

    const container = parent.querySelector('.file-tree');
    expect(container).toBeNull();
  });
});

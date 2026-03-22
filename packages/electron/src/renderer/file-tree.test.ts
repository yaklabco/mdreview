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

function createMixedEntries(): DirectoryEntry[] {
  return [
    {
      name: 'src',
      path: '/project/src',
      type: 'directory',
      children: [
        { name: 'app.ts', path: '/project/src/app.ts', type: 'file' },
        { name: 'index.md', path: '/project/src/index.md', type: 'file' },
      ],
    },
    { name: 'readme.md', path: '/project/readme.md', type: 'file' },
    { name: 'package.json', path: '/project/package.json', type: 'file' },
    { name: 'logo.png', path: '/project/logo.png', type: 'file' },
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

  describe('rerender', () => {
    it('should rebuild DOM from stored entries', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createEntries());

      const itemsBefore = parent.querySelectorAll('.file-tree-item');
      expect(itemsBefore.length).toBe(4);

      fileTree.rerender();

      const itemsAfter = parent.querySelectorAll('.file-tree-item');
      expect(itemsAfter.length).toBe(4);
    });

    it('should preserve active file across rerender', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createEntries());
      fileTree.setActiveFile('/project/docs/api.md');

      fileTree.rerender();

      const activeItems = parent.querySelectorAll('.file-tree-file.active');
      expect(activeItems.length).toBe(1);
      expect((activeItems[0] as HTMLElement).dataset.path).toBe('/project/docs/api.md');
    });

    it('should no-op if no entries have been loaded', () => {
      fileTree.render(parent);
      fileTree.rerender();

      const items = parent.querySelectorAll('.file-tree-item');
      expect(items.length).toBe(0);
    });
  });

  describe('file icons', () => {
    it('should render file-type icons in file items', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createEntries());

      const icons = parent.querySelectorAll('.file-tree-icon');
      expect(icons.length).toBeGreaterThan(0);

      // Every icon should contain an SVG element
      for (const icon of icons) {
        expect(icon.querySelector('svg')).not.toBeNull();
      }
    });

    it('should render folder icons with file-tree-icon-folder class', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createEntries());

      const folderIcons = parent.querySelectorAll('.file-tree-icon-folder');
      expect(folderIcons.length).toBe(1); // one directory entry
    });

    it('should render disclosure triangles on directories', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createEntries());

      const disclosures = parent.querySelectorAll('.file-tree-disclosure');
      expect(disclosures.length).toBe(1);
    });

    it('should rotate disclosure triangle on expand/collapse', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createEntries());

      const dirLabel = parent.querySelector('.file-tree-directory') as HTMLElement;
      const disclosure = parent.querySelector('.file-tree-disclosure') as HTMLElement;

      // Initially expanded
      expect(disclosure.classList.contains('expanded')).toBe(true);

      // Click to collapse
      dirLabel.click();
      expect(disclosure.classList.contains('expanded')).toBe(false);

      // Click to expand again
      dirLabel.click();
      expect(disclosure.classList.contains('expanded')).toBe(true);
    });

    it('should render file names in a dedicated span', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createEntries());

      const names = parent.querySelectorAll('.file-tree-name');
      expect(names.length).toBeGreaterThan(0);
    });
  });

  describe('compact folders', () => {
    function createCompactableEntries(): DirectoryEntry[] {
      return [
        {
          name: 'src',
          path: '/project/src',
          type: 'directory',
          children: [
            {
              name: 'components',
              path: '/project/src/components',
              type: 'directory',
              children: [
                { name: 'Button.tsx', path: '/project/src/components/Button.tsx', type: 'file' },
                { name: 'Input.tsx', path: '/project/src/components/Input.tsx', type: 'file' },
              ],
            },
          ],
        },
        { name: 'readme.md', path: '/project/readme.md', type: 'file' },
      ];
    }

    function createDeeplyCompactableEntries(): DirectoryEntry[] {
      return [
        {
          name: 'gen',
          path: '/project/gen',
          type: 'directory',
          children: [
            {
              name: 'controlplane',
              path: '/project/gen/controlplane',
              type: 'directory',
              children: [
                {
                  name: 'v1',
                  path: '/project/gen/controlplane/v1',
                  type: 'directory',
                  children: [
                    { name: 'api.go', path: '/project/gen/controlplane/v1/api.go', type: 'file' },
                  ],
                },
              ],
            },
          ],
        },
      ];
    }

    it('should compact single-child directory chains into one row', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createCompactableEntries());

      // src/components compacted into one row, plus 2 files inside + readme = 4 items
      const items = parent.querySelectorAll('.file-tree-item');
      expect(items.length).toBe(4);

      // Should have only 1 directory row (compacted)
      const dirs = parent.querySelectorAll('.file-tree-directory');
      expect(dirs.length).toBe(1);
    });

    it('should show compound name with path separators', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createCompactableEntries());

      const dirName = parent.querySelector('.file-tree-directory .file-tree-name') as HTMLElement;
      expect(dirName.textContent).toContain('src');
      expect(dirName.textContent).toContain('components');

      // Should have a separator
      const sep = dirName.querySelector('.file-tree-path-sep');
      expect(sep).not.toBeNull();
    });

    it('should compact three levels deep', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createDeeplyCompactableEntries());

      const dirs = parent.querySelectorAll('.file-tree-directory');
      expect(dirs.length).toBe(1);

      const dirName = parent.querySelector('.file-tree-directory .file-tree-name') as HTMLElement;
      expect(dirName.textContent).toContain('gen');
      expect(dirName.textContent).toContain('controlplane');
      expect(dirName.textContent).toContain('v1');
    });

    it('should not compact when directory has multiple children', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createEntries());

      // docs has 2 file children — should NOT be compacted
      const dirs = parent.querySelectorAll('.file-tree-directory');
      expect(dirs.length).toBe(1);

      const dirName = parent.querySelector('.file-tree-directory .file-tree-name') as HTMLElement;
      expect(dirName.textContent).toBe('docs');
    });

    it('should not compact when single child is a file', () => {
      const entries: DirectoryEntry[] = [
        {
          name: 'lib',
          path: '/project/lib',
          type: 'directory',
          children: [{ name: 'index.ts', path: '/project/lib/index.ts', type: 'file' }],
        },
      ];
      fileTree.render(parent);
      fileTree.loadDirectory(entries);

      const dirName = parent.querySelector('.file-tree-directory .file-tree-name') as HTMLElement;
      expect(dirName.textContent).toBe('lib');
    });

    it('should use the deepest folder path for context menu', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createCompactableEntries());

      const dir = parent.querySelector('.file-tree-directory') as HTMLElement;
      // The path should be the deepest compacted folder
      expect(dir.dataset.path).toBe('/project/src/components');
    });

    it('should expand/collapse compacted folder children', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createCompactableEntries());

      const dirLabel = parent.querySelector('.file-tree-directory') as HTMLElement;
      const childContainer = dirLabel
        .closest('.file-tree-item')!
        .querySelector('.file-tree-children') as HTMLElement;

      // Initially expanded
      expect(childContainer.style.display).not.toBe('none');

      // Collapse
      dirLabel.click();
      expect(childContainer.style.display).toBe('none');

      // Expand
      dirLabel.click();
      expect(childContainer.style.display).not.toBe('none');
    });
  });

  describe('non-markdown files', () => {
    it('should add file-tree-file-readonly class to non-markdown files', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createMixedEntries());

      const readonlyFiles = parent.querySelectorAll('.file-tree-file-readonly');
      // package.json, logo.png, app.ts are non-markdown
      expect(readonlyFiles.length).toBe(3);
    });

    it('should not fire onFileSelected for non-markdown files', () => {
      const callback = vi.fn();
      fileTree.render(parent);
      fileTree.onFileSelected(callback);
      fileTree.loadDirectory(createMixedEntries());

      const readonlyFile = parent.querySelector('.file-tree-file-readonly') as HTMLElement;
      readonlyFile.click();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should fire onFileSelected for markdown files in mixed entries', () => {
      const callback = vi.fn();
      fileTree.render(parent);
      fileTree.onFileSelected(callback);
      fileTree.loadDirectory(createMixedEntries());

      // Find the readme.md file (not readonly)
      const mdFiles = parent.querySelectorAll('.file-tree-file:not(.file-tree-file-readonly)');
      expect(mdFiles.length).toBeGreaterThan(0);

      (mdFiles[0] as HTMLElement).click();
      expect(callback).toHaveBeenCalled();
    });

    it('should show context menu with only path items for non-markdown files', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createMixedEntries());

      const readonlyFile = parent.querySelector('.file-tree-file-readonly') as HTMLElement;
      readonlyFile.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

      const menu = document.querySelector('.tab-context-menu');
      expect(menu).not.toBeNull();

      const items = document.querySelectorAll('.tab-context-menu-item');
      const labels = Array.from(items).map((i) => i.textContent);
      expect(labels).toContain('Copy Path');
      expect(labels).toContain('Copy Relative Path');
      // Should NOT have Open/Export items
      expect(labels).not.toContain('Open File');
      expect(labels).not.toContain('Export as PDF');
    });
  });

  describe('context menu', () => {
    it('should show context menu on right-click of a file', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createEntries());

      const fileItem = parent.querySelector('.file-tree-file') as HTMLElement;
      fileItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

      const menu = document.querySelector('.tab-context-menu');
      expect(menu).not.toBeNull();
    });

    it('should have Open, Export PDF, and Export DOCX items', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createEntries());

      const fileItem = parent.querySelector('.file-tree-file') as HTMLElement;
      fileItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

      const items = document.querySelectorAll('.tab-context-menu-item');
      const labels = Array.from(items).map((i) => i.textContent);
      expect(labels).toContain('Open File');
      expect(labels).toContain('Export as PDF');
      expect(labels).toContain('Export as DOCX');
    });

    it('should fire fileSelectCallback when Open File is clicked', () => {
      const callback = vi.fn();
      fileTree.render(parent);
      fileTree.onFileSelected(callback);
      fileTree.loadDirectory(createEntries());

      const fileItem = parent.querySelector('.file-tree-file') as HTMLElement;
      fileItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

      const items = document.querySelectorAll('.tab-context-menu-item');
      const openItem = Array.from(items).find((i) => i.textContent === 'Open File') as HTMLElement;
      openItem.click();

      expect(callback).toHaveBeenCalledWith('/project/docs/api.md');
    });

    it('should fire onFileExport callback with path and format for PDF', () => {
      const exportCallback = vi.fn();
      fileTree.render(parent);
      fileTree.onFileExport(exportCallback);
      fileTree.loadDirectory(createEntries());

      const fileItem = parent.querySelector('.file-tree-file') as HTMLElement;
      fileItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

      const items = document.querySelectorAll('.tab-context-menu-item');
      const pdfItem = Array.from(items).find(
        (i) => i.textContent === 'Export as PDF'
      ) as HTMLElement;
      pdfItem.click();

      expect(exportCallback).toHaveBeenCalledWith('/project/docs/api.md', 'pdf');
    });

    it('should fire onFileExport callback with path and format for DOCX', () => {
      const exportCallback = vi.fn();
      fileTree.render(parent);
      fileTree.onFileExport(exportCallback);
      fileTree.loadDirectory(createEntries());

      const fileItem = parent.querySelector('.file-tree-file') as HTMLElement;
      fileItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

      const items = document.querySelectorAll('.tab-context-menu-item');
      const docxItem = Array.from(items).find(
        (i) => i.textContent === 'Export as DOCX'
      ) as HTMLElement;
      docxItem.click();

      expect(exportCallback).toHaveBeenCalledWith('/project/docs/api.md', 'docx');
    });

    it('should show context menu with path items on right-click of a directory', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createEntries());

      const dirItem = parent.querySelector('.file-tree-directory') as HTMLElement;
      dirItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

      const menu = document.querySelector('.tab-context-menu');
      expect(menu).not.toBeNull();

      const items = document.querySelectorAll('.tab-context-menu-item');
      const labels = Array.from(items).map((i) => i.textContent);
      expect(labels).toContain('Copy Path');
      expect(labels).toContain('Copy Relative Path');
      // Should NOT have Open/Export items
      expect(labels).not.toContain('Open File');
      expect(labels).not.toContain('Export as PDF');
    });

    it('should dismiss context menu on outside click', async () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createEntries());

      const fileItem = parent.querySelector('.file-tree-file') as HTMLElement;
      fileItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

      expect(document.querySelector('.tab-context-menu')).not.toBeNull();

      // Wait for setTimeout(0) dismiss handler registration
      await new Promise((r) => setTimeout(r, 0));
      document.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(document.querySelector('.tab-context-menu')).toBeNull();
    });

    it('markdown file context menu includes Copy Path and Copy Relative Path', () => {
      fileTree.render(parent);
      fileTree.loadDirectory(createEntries());

      const fileItem = parent.querySelector('.file-tree-file') as HTMLElement;
      fileItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

      const items = document.querySelectorAll('.tab-context-menu-item');
      const labels = Array.from(items).map((i) => i.textContent);
      expect(labels).toContain('Copy Path');
      expect(labels).toContain('Copy Relative Path');
    });

    it('Copy Path writes absolute path to clipboard', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      fileTree.render(parent);
      fileTree.loadDirectory(createEntries());

      const fileItem = parent.querySelector('.file-tree-file') as HTMLElement;
      fileItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

      const items = document.querySelectorAll('.tab-context-menu-item');
      const copyItem = Array.from(items).find((i) => i.textContent === 'Copy Path') as HTMLElement;
      copyItem.click();

      expect(writeText).toHaveBeenCalledWith('/project/docs/api.md');
    });

    it('Copy Relative Path writes path relative to root folder', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      fileTree.render(parent);
      fileTree.setRootPath('/project');
      fileTree.loadDirectory(createEntries());

      const fileItem = parent.querySelector('.file-tree-file') as HTMLElement;
      fileItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

      const items = document.querySelectorAll('.tab-context-menu-item');
      const copyRelItem = Array.from(items).find(
        (i) => i.textContent === 'Copy Relative Path'
      ) as HTMLElement;
      copyRelItem.click();

      expect(writeText).toHaveBeenCalledWith('docs/api.md');
    });

    it('Copy Relative Path falls back to absolute path when no root set', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      fileTree.render(parent);
      // Don't call setRootPath
      fileTree.loadDirectory(createEntries());

      const fileItem = parent.querySelector('.file-tree-file') as HTMLElement;
      fileItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

      const items = document.querySelectorAll('.tab-context-menu-item');
      const copyRelItem = Array.from(items).find(
        (i) => i.textContent === 'Copy Relative Path'
      ) as HTMLElement;
      copyRelItem.click();

      expect(writeText).toHaveBeenCalledWith('/project/docs/api.md');
    });
  });
});

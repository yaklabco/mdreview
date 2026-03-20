import type { DirectoryEntry } from '../shared/workspace-types';

export class FileTree {
  private container: HTMLElement | null = null;
  private visible = true;
  private fileSelectCallback: ((path: string) => void) | null = null;
  private activeFilePath: string | null = null;

  render(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.className = 'file-tree';
    parent.appendChild(this.container);
  }

  loadDirectory(entries: DirectoryEntry[]): void {
    if (!this.container) return;

    // Clear existing content
    this.container.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'file-tree-list';
    this.buildTree(list, entries, 0);
    this.container.appendChild(list);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.container) {
      this.container.style.display = visible ? '' : 'none';
    }
  }

  onFileSelected(callback: (path: string) => void): void {
    this.fileSelectCallback = callback;
  }

  setActiveFile(filePath: string): void {
    this.activeFilePath = filePath;

    if (!this.container) return;

    // Remove existing active class
    const previousActive = this.container.querySelectorAll('.file-tree-file.active');
    for (const el of previousActive) {
      el.classList.remove('active');
    }

    // Add active class to matching file
    const fileElements = this.container.querySelectorAll('.file-tree-file');
    for (const el of fileElements) {
      if ((el as HTMLElement).dataset.path === filePath) {
        el.classList.add('active');
      }
    }
  }

  refresh(entries: DirectoryEntry[]): void {
    this.loadDirectory(entries);
    if (this.activeFilePath) {
      this.setActiveFile(this.activeFilePath);
    }
  }

  dispose(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.fileSelectCallback = null;
    this.activeFilePath = null;
  }

  private buildTree(parent: HTMLElement, entries: DirectoryEntry[], depth: number): void {
    for (const entry of entries) {
      const item = document.createElement('div');
      item.className = 'file-tree-item';
      item.style.paddingLeft = `${depth * 16}px`;

      if (entry.type === 'directory') {
        this.buildDirectoryItem(item, entry, depth);
      } else {
        this.buildFileItem(item, entry);
      }

      parent.appendChild(item);
    }
  }

  private buildDirectoryItem(item: HTMLElement, entry: DirectoryEntry, depth: number): void {
    const label = document.createElement('div');
    label.className = 'file-tree-directory';
    label.dataset.path = entry.path;
    label.textContent = entry.name;

    const childContainer = document.createElement('div');
    childContainer.className = 'file-tree-children';

    let expanded = true;

    label.addEventListener('click', () => {
      expanded = !expanded;
      childContainer.style.display = expanded ? '' : 'none';
    });

    item.appendChild(label);

    if (entry.children && entry.children.length > 0) {
      this.buildTree(childContainer, entry.children, depth + 1);
    }

    item.appendChild(childContainer);
  }

  private buildFileItem(item: HTMLElement, entry: DirectoryEntry): void {
    const label = document.createElement('div');
    label.className = 'file-tree-file';
    label.dataset.path = entry.path;
    label.textContent = entry.name;

    label.addEventListener('click', () => {
      this.fileSelectCallback?.(entry.path);
    });

    item.appendChild(label);
  }
}

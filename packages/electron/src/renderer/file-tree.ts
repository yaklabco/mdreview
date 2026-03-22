import type { DirectoryEntry } from '../shared/workspace-types';
import { getFileIconSVG, isMarkdownFile } from './file-icons';

export class FileTree {
  private container: HTMLElement | null = null;
  private visible = true;
  private fileSelectCallback: ((path: string) => void) | null = null;
  private fileExportCallback: ((path: string, format: 'pdf' | 'docx') => void) | null = null;
  private activeFilePath: string | null = null;
  private activeContextMenu: HTMLElement | null = null;
  private contextMenuDismissHandler: ((e: MouseEvent) => void) | null = null;
  private rootPath: string | null = null;
  private lastEntries: DirectoryEntry[] | null = null;

  render(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.className = 'file-tree';
    parent.appendChild(this.container);
  }

  loadDirectory(entries: DirectoryEntry[]): void {
    if (!this.container) return;

    this.lastEntries = entries;

    // Clear existing content
    this.container.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'file-tree-list';
    this.buildTree(list, entries, 0);
    this.container.appendChild(list);
  }

  rerender(): void {
    if (!this.lastEntries) return;
    this.loadDirectory(this.lastEntries);
    if (this.activeFilePath) {
      this.setActiveFile(this.activeFilePath);
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.container) {
      this.container.style.display = visible ? '' : 'none';
    }
  }

  setRootPath(path: string): void {
    this.rootPath = path;
  }

  onFileSelected(callback: (path: string) => void): void {
    this.fileSelectCallback = callback;
  }

  onFileExport(callback: (path: string, format: 'pdf' | 'docx') => void): void {
    this.fileExportCallback = callback;
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
    this.dismissContextMenu();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.fileSelectCallback = null;
    this.fileExportCallback = null;
    this.activeFilePath = null;
    this.rootPath = null;
    this.lastEntries = null;
  }

  private buildTree(parent: HTMLElement, entries: DirectoryEntry[], depth: number): void {
    for (const entry of entries) {
      const item = document.createElement('div');
      item.className = 'file-tree-item';
      item.style.paddingLeft = `${8 + depth * 8}px`;

      if (entry.type === 'directory') {
        // Compact single-child directory chains (VSCode-style)
        const { segments, finalEntry } = this.compactFolderChain(entry);
        this.buildDirectoryItem(item, finalEntry, depth, segments);
      } else {
        this.buildFileItem(item, entry);
      }

      parent.appendChild(item);
    }
  }

  /**
   * Walk a chain of single-child directories and collect their names.
   * Returns the segments and the deepest entry whose children should be rendered.
   */
  private compactFolderChain(entry: DirectoryEntry): { segments: string[]; finalEntry: DirectoryEntry } {
    const segments = [entry.name];
    let current = entry;

    while (
      current.children &&
      current.children.length === 1 &&
      current.children[0].type === 'directory'
    ) {
      current = current.children[0];
      segments.push(current.name);
    }

    return { segments, finalEntry: current };
  }

  private buildDirectoryItem(
    item: HTMLElement,
    entry: DirectoryEntry,
    depth: number,
    segments: string[] = [entry.name],
  ): void {
    const label = document.createElement('div');
    label.className = 'file-tree-directory';
    label.dataset.path = entry.path;

    // Disclosure triangle
    const disclosure = document.createElement('span');
    disclosure.className = 'file-tree-disclosure expanded';
    disclosure.textContent = '\u25B6';

    // Folder icon
    const icon = document.createElement('span');
    icon.className = 'file-tree-icon file-tree-icon-folder';
    icon.innerHTML = getFileIconSVG(entry.name, true, true);

    // Name — render compound segments with separators
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-tree-name';
    if (segments.length === 1) {
      nameSpan.textContent = segments[0];
    } else {
      for (let i = 0; i < segments.length; i++) {
        if (i > 0) {
          const sep = document.createElement('span');
          sep.className = 'file-tree-path-sep';
          sep.textContent = ' / ';
          nameSpan.appendChild(sep);
        }
        nameSpan.appendChild(document.createTextNode(segments[i]));
      }
    }

    label.appendChild(disclosure);
    label.appendChild(icon);
    label.appendChild(nameSpan);

    const childContainer = document.createElement('div');
    childContainer.className = 'file-tree-children';

    let expanded = true;

    label.addEventListener('click', () => {
      expanded = !expanded;
      childContainer.style.display = expanded ? '' : 'none';
      disclosure.classList.toggle('expanded', expanded);
      icon.innerHTML = getFileIconSVG(entry.name, true, expanded);
    });

    label.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showPathContextMenu(entry.path, e.clientX, e.clientY);
    });

    item.appendChild(label);

    if (entry.children && entry.children.length > 0) {
      this.buildTree(childContainer, entry.children, depth + 1);
    }

    item.appendChild(childContainer);
  }

  private buildFileItem(item: HTMLElement, entry: DirectoryEntry): void {
    const isMd = isMarkdownFile(entry.name);

    const label = document.createElement('div');
    label.className = 'file-tree-file';
    if (!isMd) {
      label.classList.add('file-tree-file-readonly');
    }
    label.dataset.path = entry.path;

    // File icon
    const icon = document.createElement('span');
    icon.className = 'file-tree-icon';
    icon.innerHTML = getFileIconSVG(entry.name, false);

    // Name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-tree-name';
    nameSpan.textContent = entry.name;

    label.appendChild(icon);
    label.appendChild(nameSpan);

    if (isMd) {
      label.addEventListener('click', () => {
        this.fileSelectCallback?.(entry.path);
      });

      label.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showMarkdownFileContextMenu(entry.path, e.clientX, e.clientY);
      });
    } else {
      label.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showPathContextMenu(entry.path, e.clientX, e.clientY);
      });
    }

    item.appendChild(label);
  }

  private showMarkdownFileContextMenu(filePath: string, x: number, y: number): void {
    this.dismissContextMenu();

    const menu = document.createElement('div');
    menu.className = 'tab-context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Open File
    menu.appendChild(this.createMenuItem('Open File', () => {
      this.fileSelectCallback?.(filePath);
    }));

    // Separator
    menu.appendChild(this.createSeparator());

    // Export as PDF
    menu.appendChild(this.createMenuItem('Export as PDF', () => {
      this.fileExportCallback?.(filePath, 'pdf');
    }));

    // Export as DOCX
    menu.appendChild(this.createMenuItem('Export as DOCX', () => {
      this.fileExportCallback?.(filePath, 'docx');
    }));

    // Separator before path items
    menu.appendChild(this.createSeparator());

    // Copy path items
    this.appendCopyPathItems(menu, filePath);

    this.showMenu(menu);
  }

  private showPathContextMenu(path: string, x: number, y: number): void {
    this.dismissContextMenu();

    const menu = document.createElement('div');
    menu.className = 'tab-context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    this.appendCopyPathItems(menu, path);

    this.showMenu(menu);
  }

  private appendCopyPathItems(menu: HTMLElement, path: string): void {
    menu.appendChild(this.createMenuItem('Copy Path', () => {
      void navigator.clipboard.writeText(path);
    }));

    menu.appendChild(this.createMenuItem('Copy Relative Path', () => {
      void navigator.clipboard.writeText(this.getRelativePath(path));
    }));
  }

  private showMenu(menu: HTMLElement): void {
    document.body.appendChild(menu);
    this.activeContextMenu = menu;

    this.contextMenuDismissHandler = () => {
      this.dismissContextMenu();
    };
    setTimeout(() => {
      document.addEventListener('click', this.contextMenuDismissHandler!);
    }, 0);
  }

  private createMenuItem(label: string, action: () => void): HTMLElement {
    const item = document.createElement('div');
    item.className = 'tab-context-menu-item';
    item.textContent = label;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissContextMenu();
      action();
    });
    return item;
  }

  private createSeparator(): HTMLElement {
    const separator = document.createElement('div');
    separator.className = 'tab-context-menu-separator';
    return separator;
  }

  private getRelativePath(absolutePath: string): string {
    if (!this.rootPath) return absolutePath;
    const prefix = this.rootPath.endsWith('/') ? this.rootPath : this.rootPath + '/';
    if (absolutePath.startsWith(prefix)) {
      return absolutePath.slice(prefix.length);
    }
    return absolutePath;
  }

  private dismissContextMenu(): void {
    if (this.activeContextMenu) {
      this.activeContextMenu.remove();
      this.activeContextMenu = null;
    }
    if (this.contextMenuDismissHandler) {
      document.removeEventListener('click', this.contextMenuDismissHandler);
      this.contextMenuDismissHandler = null;
    }
  }
}

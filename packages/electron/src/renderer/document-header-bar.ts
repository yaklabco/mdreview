// SVG kept for future use when export button is added to the header bar
// const EXPORT_ICON_SVG = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M8 1a.5.5 0 0 1 .5.5v8.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.293V1.5A.5.5 0 0 1 8 1zM2 13.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/></svg>`;

export type ExportFormat = 'pdf' | 'docx';

export class DocumentHeaderBar {
  private container: HTMLElement | null = null;
  private breadcrumbEl: HTMLElement | null = null;
  private actionsEl: HTMLElement | null = null;
  private exportCallback: ((format: ExportFormat) => void) | null = null;
  private breadcrumbClickCallback: ((folderPath: string) => void) | null = null;
  private activeDropdown: HTMLElement | null = null;
  private dropdownDismissHandler: (() => void) | null = null;
  private currentFilePath: string | null = null;
  private currentFolderPath: string | null = null;

  render(container: HTMLElement): void {
    this.container = container;
    this.breadcrumbEl = document.createElement('div');
    this.breadcrumbEl.className = 'header-bar-breadcrumb';
    container.appendChild(this.breadcrumbEl);

    this.actionsEl = document.createElement('div');
    this.actionsEl.className = 'header-bar-actions';
    container.appendChild(this.actionsEl);
  }

  update(filePath: string | null, openFolderPath: string | null): void {
    this.currentFilePath = filePath;
    this.currentFolderPath = openFolderPath;
    this.renderBreadcrumb();
    this.renderActions();
  }

  setVisible(visible: boolean): void {
    if (!this.container) return;
    if (visible) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
    }
  }

  onExport(callback: (format: ExportFormat) => void): void {
    this.exportCallback = callback;
  }

  onBreadcrumbClick(callback: (folderPath: string) => void): void {
    this.breadcrumbClickCallback = callback;
  }

  dispose(): void {
    this.dismissDropdown();
    if (this.breadcrumbEl) {
      this.breadcrumbEl.innerHTML = '';
    }
    if (this.actionsEl) {
      this.actionsEl.innerHTML = '';
    }
  }

  private renderBreadcrumb(): void {
    if (!this.breadcrumbEl) return;
    this.breadcrumbEl.innerHTML = '';

    if (!this.currentFilePath) return;

    const segments = this.computeSegments(this.currentFilePath, this.currentFolderPath);

    for (let i = 0; i < segments.length; i++) {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'header-bar-breadcrumb-separator';
        sep.textContent = '\u203A';
        this.breadcrumbEl.appendChild(sep);
      }

      const seg = document.createElement('span');
      seg.className = 'header-bar-breadcrumb-segment';
      seg.textContent = segments[i].name;

      // Only folder segments (not the last one) are clickable
      if (i < segments.length - 1 && segments[i].path) {
        seg.addEventListener('click', () => {
          this.breadcrumbClickCallback?.(segments[i].path!);
        });
      }

      this.breadcrumbEl.appendChild(seg);
    }
  }

  private computeSegments(
    filePath: string,
    folderPath: string | null
  ): Array<{ name: string; path?: string }> {
    // Extract just the filename if no folder context
    if (!folderPath || !filePath.startsWith(folderPath)) {
      const parts = filePath.split('/');
      return [{ name: parts[parts.length - 1] }];
    }

    // Compute relative path
    let relativePath = filePath.slice(folderPath.length);
    if (relativePath.startsWith('/')) {
      relativePath = relativePath.slice(1);
    }

    const parts = relativePath.split('/');
    const segments: Array<{ name: string; path?: string }> = [];

    for (let i = 0; i < parts.length; i++) {
      const isFile = i === parts.length - 1;
      const segPath = isFile ? undefined : folderPath + '/' + parts.slice(0, i + 1).join('/');
      segments.push({ name: parts[i], path: segPath });
    }

    return segments;
  }

  private renderActions(): void {
    if (!this.actionsEl) return;
    this.actionsEl.innerHTML = '';

    if (!this.currentFilePath) return;

    const exportBtn = document.createElement('button');
    exportBtn.className = 'header-bar-action-btn header-bar-export-btn';
    exportBtn.title = 'Export';
    exportBtn.textContent = 'Export';

    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleExportDropdown(exportBtn);
    });

    this.actionsEl.appendChild(exportBtn);
  }

  private toggleExportDropdown(anchorEl: HTMLElement): void {
    if (this.activeDropdown) {
      this.dismissDropdown();
      return;
    }

    const dropdown = document.createElement('div');
    dropdown.className = 'header-bar-dropdown';

    const pdfItem = this.createDropdownItem('Export as PDF', () => {
      this.exportCallback?.('pdf');
    });
    const docxItem = this.createDropdownItem('Export as DOCX', () => {
      this.exportCallback?.('docx');
    });

    dropdown.appendChild(pdfItem);
    dropdown.appendChild(docxItem);

    // Position fixed on body using anchor rect
    const rect = anchorEl.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = `${rect.bottom + 2}px`;
    dropdown.style.right = `${window.innerWidth - rect.right}px`;

    document.body.appendChild(dropdown);
    this.activeDropdown = dropdown;

    this.dropdownDismissHandler = () => {
      this.dismissDropdown();
    };
    setTimeout(() => {
      document.addEventListener('click', this.dropdownDismissHandler!);
    }, 0);
  }

  private createDropdownItem(label: string, action: () => void): HTMLElement {
    const item = document.createElement('div');
    item.className = 'header-bar-dropdown-item';
    item.textContent = label;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissDropdown();
      action();
    });
    return item;
  }

  private dismissDropdown(): void {
    if (this.activeDropdown) {
      this.activeDropdown.remove();
      this.activeDropdown = null;
    }
    if (this.dropdownDismissHandler) {
      document.removeEventListener('click', this.dropdownDismissHandler);
      this.dropdownDismissHandler = null;
    }
  }
}

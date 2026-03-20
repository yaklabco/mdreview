interface TabEntry {
  id: string;
  filePath: string;
  title: string;
  buttonEl: HTMLElement;
  containerEl: HTMLElement;
}

export class TabManager {
  private tabs = new Map<string, TabEntry>();
  private activeTabId: string | null = null;
  private tabBar: HTMLElement | null = null;
  private contentArea: HTMLElement | null = null;
  private tabClickCallback: ((tabId: string) => void) | null = null;
  private tabCloseCallback: ((tabId: string) => void) | null = null;

  render(tabBar: HTMLElement): void {
    this.tabBar = tabBar;
  }

  setContentArea(contentArea: HTMLElement): void {
    this.contentArea = contentArea;
  }

  createTab(id: string, filePath: string, title: string): void {
    if (this.tabs.has(id)) return;

    const buttonEl = this.createTabButton(id, title);
    const containerEl = document.createElement('div');
    containerEl.className = 'mdview-tab-content';
    containerEl.dataset.tabContentId = id;

    if (this.contentArea) {
      this.contentArea.appendChild(containerEl);
    }

    this.tabs.set(id, { id, filePath, title, buttonEl, containerEl });

    if (this.tabBar) {
      this.tabBar.appendChild(buttonEl);
    }

    this.activateTab(id);
  }

  activateTab(id: string): void {
    const tab = this.tabs.get(id);
    if (!tab) return;

    this.activeTabId = id;

    for (const [tabId, entry] of this.tabs) {
      if (tabId === id) {
        entry.buttonEl.classList.add('active');
        entry.containerEl.style.display = '';
      } else {
        entry.buttonEl.classList.remove('active');
        entry.containerEl.style.display = 'none';
      }
    }
  }

  closeTab(id: string): void {
    const tab = this.tabs.get(id);
    if (!tab) return;

    tab.buttonEl.remove();
    tab.containerEl.remove();
    this.tabs.delete(id);

    if (this.activeTabId === id) {
      this.activeTabId = null;
    }
  }

  getActiveTab(): string | null {
    return this.activeTabId;
  }

  getTabCount(): number {
    return this.tabs.size;
  }

  getTabContainer(id: string): HTMLElement | null {
    return this.tabs.get(id)?.containerEl ?? null;
  }

  onTabClick(callback: (tabId: string) => void): void {
    this.tabClickCallback = callback;
  }

  onTabClose(callback: (tabId: string) => void): void {
    this.tabCloseCallback = callback;
  }

  getTabIds(): string[] {
    return Array.from(this.tabs.keys());
  }

  dispose(): void {
    for (const tab of this.tabs.values()) {
      tab.buttonEl.remove();
      tab.containerEl.remove();
    }
    this.tabs.clear();
    this.activeTabId = null;
  }

  private createTabButton(id: string, title: string): HTMLElement {
    const btn = document.createElement('div');
    btn.className = 'tab-button';
    btn.dataset.tabId = id;

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = title;

    const closeBtn = document.createElement('span');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.tabCloseCallback?.(id);
    });

    btn.appendChild(label);
    btn.appendChild(closeBtn);

    btn.addEventListener('click', () => {
      this.tabClickCallback?.(id);
    });

    btn.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        this.tabCloseCallback?.(id);
      }
    });

    return btn;
  }
}

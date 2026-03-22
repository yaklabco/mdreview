import type { TabGroupColor, TabGroupState } from '../shared/workspace-types';

export const TAB_IDEAL_WIDTH = 200;
export const TAB_MIN_WIDTH = 80;
export const TAB_ICON_ONLY_WIDTH = 36;

const TAB_ICON_SVG = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 1C2.67 1 2 1.67 2 2.5v11c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5v-8L9.5 1h-6zM9 2l4 4H9.5a.5.5 0 0 1-.5-.5V2zM4 8h8v1H4V8zm0 2.5h6v1H4v-1z"/></svg>`;

interface TabEntry {
  id: string;
  filePath: string;
  title: string;
  buttonEl: HTMLElement;
  containerEl: HTMLElement;
  groupId?: string;
}

interface TabGroup {
  id: string;
  name: string;
  color: TabGroupColor;
  collapsed: boolean;
  tabIds: string[];
  chipEl: HTMLElement;
}

export class TabManager {
  private tabs = new Map<string, TabEntry>();
  private activeTabId: string | null = null;
  private tabBar: HTMLElement | null = null;
  private contentArea: HTMLElement | null = null;
  private tabClickCallback: ((tabId: string) => void) | null = null;
  private tabCloseCallback: ((tabId: string) => void) | null = null;
  private groupChangedCallback: ((groups: TabGroupState[]) => void) | null = null;
  private tabExportCallback: ((tabId: string, format: 'pdf' | 'docx') => void) | null = null;

  private groups = new Map<string, TabGroup>();
  private resizeObserver: ResizeObserver | null = null;
  private lastBarWidth = 0;
  private groupCounter = 0;

  render(tabBar: HTMLElement): void {
    this.tabBar = tabBar;
    this.setupResizeObserver();
  }

  setContentArea(contentArea: HTMLElement): void {
    this.contentArea = contentArea;
  }

  createTab(id: string, filePath: string, title: string): void {
    if (this.tabs.has(id)) return;

    const buttonEl = this.createTabButton(id, title);

    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'mdreview-tab-content-wrapper';
    wrapperEl.dataset.tabWrapperId = id;

    const containerEl = document.createElement('div');
    containerEl.className = 'mdreview-tab-content';
    containerEl.dataset.tabContentId = id;

    wrapperEl.appendChild(containerEl);

    if (this.contentArea) {
      this.contentArea.appendChild(wrapperEl);
    }

    this.tabs.set(id, { id, filePath, title, buttonEl, containerEl });

    if (this.tabBar) {
      this.tabBar.appendChild(buttonEl);
    }

    this.activateTab(id);
    this.recalculateTabWidths();
  }

  activateTab(id: string): void {
    const tab = this.tabs.get(id);
    if (!tab) return;

    this.activeTabId = id;

    for (const [tabId, entry] of this.tabs) {
      const wrapper = entry.containerEl.parentElement;
      if (tabId === id) {
        entry.buttonEl.classList.add('active');
        if (wrapper) wrapper.style.display = '';
      } else {
        entry.buttonEl.classList.remove('active');
        if (wrapper) wrapper.style.display = 'none';
      }
    }
  }

  closeTab(id: string): void {
    const tab = this.tabs.get(id);
    if (!tab) return;

    // Remove from group if grouped
    if (tab.groupId) {
      this.removeTabFromGroupInternal(id, false);
    }

    tab.buttonEl.remove();
    const wrapper = tab.containerEl.parentElement;
    if (wrapper) {
      wrapper.remove();
    } else {
      tab.containerEl.remove();
    }
    this.tabs.delete(id);

    if (this.activeTabId === id) {
      this.activeTabId = null;
    }

    this.recalculateTabWidths();
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

  onGroupChanged(callback: (groups: TabGroupState[]) => void): void {
    this.groupChangedCallback = callback;
  }

  onTabExport(callback: (tabId: string, format: 'pdf' | 'docx') => void): void {
    this.tabExportCallback = callback;
  }

  getTabIds(): string[] {
    return Array.from(this.tabs.keys());
  }

  // --- Group API ---

  createGroup(name: string, color: TabGroupColor, tabIds: string[]): string {
    const id = `group-${Date.now()}-${++this.groupCounter}`;
    const chipEl = this.createGroupChip(id, name, color);

    const group: TabGroup = { id, name, color, collapsed: false, tabIds: [], chipEl };
    this.groups.set(id, group);

    for (const tabId of tabIds) {
      this.addTabToGroupInternal(tabId, id);
    }

    this.reorderTabBar();
    this.fireGroupChanged();
    return id;
  }

  addTabToGroup(tabId: string, groupId: string): void {
    this.addTabToGroupInternal(tabId, groupId);
    this.reorderTabBar();
    this.fireGroupChanged();
  }

  removeTabFromGroup(tabId: string): void {
    this.removeTabFromGroupInternal(tabId, true);
  }

  toggleGroupCollapsed(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    group.collapsed = !group.collapsed;

    if (group.collapsed) {
      group.chipEl.classList.add('collapsed');
    } else {
      group.chipEl.classList.remove('collapsed');
    }

    for (const tabId of group.tabIds) {
      const tab = this.tabs.get(tabId);
      if (tab) {
        tab.buttonEl.style.display = group.collapsed ? 'none' : '';
      }
    }

    this.recalculateTabWidths();
    this.fireGroupChanged();
  }

  updateGroup(groupId: string, updates: { name?: string; color?: TabGroupColor }): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    if (updates.name !== undefined) {
      group.name = updates.name;
      const label = group.chipEl.querySelector('.tab-group-chip-label');
      if (label) label.textContent = updates.name;

      if (updates.name === '') {
        group.chipEl.classList.add('dot-mode');
      } else {
        group.chipEl.classList.remove('dot-mode');
      }
    }

    if (updates.color !== undefined) {
      // Remove old color class
      group.chipEl.className = group.chipEl.className.replace(/tab-group-color-\w+/, '');
      group.color = updates.color;
      group.chipEl.classList.add(`tab-group-color-${updates.color}`);

      // Update tab data attributes
      for (const tabId of group.tabIds) {
        const tab = this.tabs.get(tabId);
        if (tab) {
          tab.buttonEl.setAttribute('data-group-color', updates.color);
        }
      }
    }

    this.fireGroupChanged();
  }

  deleteGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    // Ungroup all tabs
    for (const tabId of [...group.tabIds]) {
      const tab = this.tabs.get(tabId);
      if (tab) {
        tab.groupId = undefined;
        tab.buttonEl.removeAttribute('data-group-color');
        tab.buttonEl.style.removeProperty('--tab-group-color');
      }
    }

    group.chipEl.remove();
    this.groups.delete(groupId);
    this.reorderTabBar();
    this.fireGroupChanged();
  }

  getGroup(groupId: string): TabGroupState | undefined {
    const group = this.groups.get(groupId);
    if (!group) return undefined;
    return {
      id: group.id,
      name: group.name,
      color: group.color,
      collapsed: group.collapsed,
      tabIds: [...group.tabIds],
    };
  }

  getGroups(): TabGroupState[] {
    return Array.from(this.groups.values()).map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      collapsed: g.collapsed,
      tabIds: [...g.tabIds],
    }));
  }

  restoreGroups(groups: TabGroupState[]): void {
    for (const g of groups) {
      const validTabIds = g.tabIds.filter((id) => this.tabs.has(id));
      if (validTabIds.length === 0) continue;

      const chipEl = this.createGroupChip(g.id, g.name, g.color);
      const group: TabGroup = {
        id: g.id,
        name: g.name,
        color: g.color,
        collapsed: g.collapsed,
        tabIds: [],
        chipEl,
      };
      this.groups.set(g.id, group);

      for (const tabId of validTabIds) {
        this.addTabToGroupInternal(tabId, g.id);
      }

      if (g.collapsed) {
        chipEl.classList.add('collapsed');
        for (const tabId of validTabIds) {
          const tab = this.tabs.get(tabId);
          if (tab) tab.buttonEl.style.display = 'none';
        }
      }
    }

    this.reorderTabBar();
  }

  dispose(): void {
    for (const tab of this.tabs.values()) {
      tab.buttonEl.remove();
      const wrapper = tab.containerEl.parentElement;
      if (wrapper) {
        wrapper.remove();
      } else {
        tab.containerEl.remove();
      }
    }
    for (const group of this.groups.values()) {
      group.chipEl.remove();
    }
    this.tabs.clear();
    this.groups.clear();
    this.activeTabId = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.dismissContextMenu();
    this.dismissEditorBubble();
  }

  // --- Dynamic sizing ---

  recalculateTabWidths(): void {
    if (!this.tabBar) return;

    const barWidth = this.lastBarWidth || this.tabBar.clientWidth;
    if (barWidth === 0) return;

    // Count visible (non-collapsed) tabs
    let visibleCount = 0;
    for (const tab of this.tabs.values()) {
      const group = tab.groupId ? this.groups.get(tab.groupId) : undefined;
      if (!group?.collapsed) {
        visibleCount++;
      }
    }

    if (visibleCount === 0) return;

    // Subtract chip widths (estimate 80px per chip for visible groups)
    let chipSpace = 0;
    chipSpace = this.groups.size * 80; // approximate chip width per group

    const availableWidth = Math.max(0, barWidth - chipSpace);
    const perTab = availableWidth / visibleCount;

    for (const tab of this.tabs.values()) {
      const group = tab.groupId ? this.groups.get(tab.groupId) : undefined;
      if (group?.collapsed) continue;

      if (perTab < TAB_MIN_WIDTH) {
        tab.buttonEl.classList.add('icon-only');
        tab.buttonEl.style.maxWidth = `${TAB_ICON_ONLY_WIDTH}px`;
      } else {
        tab.buttonEl.classList.remove('icon-only');
        const width = Math.min(perTab, TAB_IDEAL_WIDTH);
        tab.buttonEl.style.maxWidth = `${Math.floor(width)}px`;
      }
    }
  }

  private setupResizeObserver(): void {
    if (!this.tabBar || typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.lastBarWidth = entry.contentRect.width;
      }
      this.recalculateTabWidths();
    });
    this.resizeObserver.observe(this.tabBar);
  }

  // --- Internal helpers ---

  private addTabToGroupInternal(tabId: string, groupId: string): void {
    const tab = this.tabs.get(tabId);
    const group = this.groups.get(groupId);
    if (!tab || !group) return;

    // Remove from previous group if any
    if (tab.groupId && tab.groupId !== groupId) {
      this.removeTabFromGroupInternal(tabId, false);
    }

    tab.groupId = groupId;
    if (!group.tabIds.includes(tabId)) {
      group.tabIds.push(tabId);
    }

    tab.buttonEl.setAttribute('data-group-color', group.color);
  }

  private removeTabFromGroupInternal(tabId: string, fireEvents: boolean): void {
    const tab = this.tabs.get(tabId);
    if (!tab?.groupId) return;

    const group = this.groups.get(tab.groupId);
    tab.groupId = undefined;
    tab.buttonEl.removeAttribute('data-group-color');
    tab.buttonEl.style.removeProperty('--tab-group-color');
    tab.buttonEl.style.display = '';

    if (group) {
      group.tabIds = group.tabIds.filter((id) => id !== tabId);
      if (group.tabIds.length === 0) {
        group.chipEl.remove();
        this.groups.delete(group.id);
      }
    }

    if (fireEvents) {
      this.reorderTabBar();
      this.fireGroupChanged();
    }
  }

  private reorderTabBar(): void {
    if (!this.tabBar) return;

    // Detach all tab buttons and chips
    for (const tab of this.tabs.values()) {
      tab.buttonEl.remove();
    }
    for (const group of this.groups.values()) {
      group.chipEl.remove();
    }

    // Walk tabs in Map insertion order. When we encounter a grouped tab
    // whose group chip hasn't been rendered yet, insert chip + all group
    // tabs at that position.
    const renderedGroups = new Set<string>();

    for (const tab of this.tabs.values()) {
      if (!tab.groupId) {
        this.tabBar.appendChild(tab.buttonEl);
      } else if (!renderedGroups.has(tab.groupId)) {
        const group = this.groups.get(tab.groupId);
        if (group) {
          renderedGroups.add(tab.groupId);
          this.tabBar.appendChild(group.chipEl);
          for (const tabId of group.tabIds) {
            const groupTab = this.tabs.get(tabId);
            if (groupTab) {
              this.tabBar.appendChild(groupTab.buttonEl);
            }
          }
        }
      }
      // If grouped and group already rendered, skip (already appended)
    }
  }

  private createTabButton(id: string, title: string): HTMLElement {
    const btn = document.createElement('div');
    btn.className = 'tab-button';
    btn.dataset.tabId = id;

    const icon = document.createElement('span');
    icon.className = 'tab-icon';
    icon.innerHTML = TAB_ICON_SVG;

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

    btn.appendChild(icon);
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

    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(id, e.clientX, e.clientY);
    });

    return btn;
  }

  private createGroupChip(groupId: string, name: string, color: TabGroupColor): HTMLElement {
    const chip = document.createElement('div');
    chip.className = `tab-group-chip tab-group-color-${color}`;
    chip.dataset.groupId = groupId;

    const dot = document.createElement('span');
    dot.className = 'tab-group-chip-dot';

    const label = document.createElement('span');
    label.className = 'tab-group-chip-label';
    label.textContent = name;

    chip.appendChild(dot);
    chip.appendChild(label);

    if (name === '') {
      chip.classList.add('dot-mode');
    }

    chip.addEventListener('click', () => {
      this.toggleGroupCollapsed(groupId);
    });

    chip.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showGroupEditorBubble(groupId);
    });

    return chip;
  }

  // --- Editor bubble ---

  private activeEditorBubble: HTMLElement | null = null;
  private editorBubbleDismissMousedown: ((e: MouseEvent) => void) | null = null;
  private editorBubbleDismissKeydown: ((e: KeyboardEvent) => void) | null = null;

  private showGroupEditorBubble(groupId: string): void {
    this.dismissEditorBubble();
    this.dismissContextMenu();

    const group = this.groups.get(groupId);
    if (!group) return;

    const bubble = document.createElement('div');
    bubble.className = 'tab-group-editor-bubble';

    // Name input
    const nameInput = document.createElement('input');
    nameInput.className = 'tab-group-editor-name';
    nameInput.type = 'text';
    nameInput.value = group.name;
    nameInput.placeholder = 'Name this group';
    nameInput.addEventListener('input', () => {
      this.updateGroup(groupId, { name: nameInput.value });
    });
    bubble.appendChild(nameInput);

    // Color swatches
    const colors: TabGroupColor[] = [
      'grey',
      'blue',
      'red',
      'yellow',
      'green',
      'pink',
      'purple',
      'cyan',
      'orange',
    ];
    const colorGrid = document.createElement('div');
    colorGrid.className = 'tab-group-editor-colors';

    for (const color of colors) {
      const swatch = document.createElement('div');
      swatch.className = `tab-group-color-swatch tab-group-color-${color}`;
      swatch.dataset.color = color;
      if (color === group.color) {
        swatch.classList.add('selected');
      }
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.updateGroup(groupId, { color });
        // Update selected state
        for (const s of colorGrid.querySelectorAll('.tab-group-color-swatch')) {
          s.classList.remove('selected');
        }
        swatch.classList.add('selected');
      });
      colorGrid.appendChild(swatch);
    }
    bubble.appendChild(colorGrid);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'tab-group-editor-actions';

    const ungroupBtn = document.createElement('button');
    ungroupBtn.className = 'tab-group-editor-action';
    ungroupBtn.textContent = 'Ungroup';
    ungroupBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissEditorBubble();
      this.deleteGroup(groupId);
    });
    actions.appendChild(ungroupBtn);

    const closeGroupBtn = document.createElement('button');
    closeGroupBtn.className = 'tab-group-editor-action tab-group-editor-action-danger';
    closeGroupBtn.textContent = 'Close group';
    closeGroupBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissEditorBubble();
      this.closeGroup(groupId);
    });
    actions.appendChild(closeGroupBtn);

    bubble.appendChild(actions);

    document.body.appendChild(bubble);
    this.activeEditorBubble = bubble;
    nameInput.focus();

    // Position below chip
    const chipRect = group.chipEl.getBoundingClientRect();
    bubble.style.position = 'fixed';
    bubble.style.left = `${chipRect.left}px`;
    bubble.style.top = `${chipRect.bottom + 4}px`;

    // Dismiss handlers
    this.editorBubbleDismissKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.dismissEditorBubble();
      }
    };
    document.addEventListener('keydown', this.editorBubbleDismissKeydown);

    this.editorBubbleDismissMousedown = (e: MouseEvent) => {
      if (!bubble.contains(e.target as Node)) {
        this.dismissEditorBubble();
      }
    };
    setTimeout(() => {
      document.addEventListener('mousedown', this.editorBubbleDismissMousedown!);
    }, 0);
  }

  private dismissEditorBubble(): void {
    if (this.activeEditorBubble) {
      this.activeEditorBubble.remove();
      this.activeEditorBubble = null;
    }
    if (this.editorBubbleDismissKeydown) {
      document.removeEventListener('keydown', this.editorBubbleDismissKeydown);
      this.editorBubbleDismissKeydown = null;
    }
    if (this.editorBubbleDismissMousedown) {
      document.removeEventListener('mousedown', this.editorBubbleDismissMousedown);
      this.editorBubbleDismissMousedown = null;
    }
  }

  closeGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    const tabIds = [...group.tabIds];
    for (const tabId of tabIds) {
      this.tabCloseCallback?.(tabId);
    }
  }

  // --- Context menu ---

  private activeContextMenu: HTMLElement | null = null;
  private contextMenuDismissHandler: ((e: MouseEvent) => void) | null = null;

  private showContextMenu(tabId: string, x: number, y: number): void {
    this.dismissContextMenu();

    const tab = this.tabs.get(tabId);
    if (!tab) return;

    const menu = document.createElement('div');
    menu.className = 'tab-context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    if (tab.groupId) {
      const group = this.groups.get(tab.groupId);
      const removeItem = this.createMenuItem(
        `Remove from group${group ? ` "${group.name}"` : ''}`,
        () => {
          this.removeTabFromGroup(tabId);
        }
      );
      menu.appendChild(removeItem);
    } else {
      // Add to new group
      const newGroupItem = this.createMenuItem('Add to new group', () => {
        this.createGroup('New group', 'grey', [tabId]);
      });
      menu.appendChild(newGroupItem);

      // Add to existing groups
      if (this.groups.size > 0) {
        for (const group of this.groups.values()) {
          const item = this.createMenuItem(`Add to "${group.name}"`, () => {
            this.addTabToGroup(tabId, group.id);
          });
          menu.appendChild(item);
        }
      }
    }

    // Separator + export
    const exportSep = document.createElement('div');
    exportSep.className = 'tab-context-menu-separator';
    menu.appendChild(exportSep);

    const pdfItem = this.createMenuItem('Export as PDF', () => {
      this.tabExportCallback?.(tabId, 'pdf');
    });
    menu.appendChild(pdfItem);

    const docxItem = this.createMenuItem('Export as DOCX', () => {
      this.tabExportCallback?.(tabId, 'docx');
    });
    menu.appendChild(docxItem);

    // Separator + close
    const separator = document.createElement('div');
    separator.className = 'tab-context-menu-separator';
    menu.appendChild(separator);

    const closeItem = this.createMenuItem('Close tab', () => {
      this.tabCloseCallback?.(tabId);
    });
    menu.appendChild(closeItem);

    document.body.appendChild(menu);
    this.activeContextMenu = menu;

    this.contextMenuDismissHandler = () => {
      this.dismissContextMenu();
    };
    // Use setTimeout to avoid the same click that opened the menu from closing it
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

  private fireGroupChanged(): void {
    this.groupChangedCallback?.(this.getGroups());
  }
}

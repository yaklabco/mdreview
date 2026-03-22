import type { AppState, Preferences } from '@mdview/core/node';
import { DEFAULT_STATE } from '@mdview/core/node';
import type { StorageAdapter } from '@mdview/core/node';
import { basename } from 'path';
import {
  type TabState,
  type TabGroupState,
  type TabGroupColor,
  type WorkspaceState,
  DEFAULT_WORKSPACE_STATE,
} from '../shared/workspace-types';

let tabCounter = 0;

function generateTabId(): string {
  return `tab-${Date.now()}-${++tabCounter}`;
}

// Electron-specific preference overrides (desktop apps have different security context)
const ELECTRON_PREFERENCE_DEFAULTS: Partial<Preferences> = {
  enableHtml: true, // Desktop apps render HTML in markdown by default
};

export class StateManager {
  private state: AppState = structuredClone(DEFAULT_STATE);
  private workspace: WorkspaceState = structuredClone(DEFAULT_WORKSPACE_STATE);

  constructor(private storage: StorageAdapter) {
    // Apply Electron-specific defaults before stored prefs override them
    Object.assign(this.state.preferences, ELECTRON_PREFERENCE_DEFAULTS);
  }

  async initialize(): Promise<void> {
    const syncData = await this.storage.getSync('preferences');
    const storedPrefs: unknown = syncData['preferences'];
    if (storedPrefs && typeof storedPrefs === 'object') {
      Object.assign(this.state.preferences, storedPrefs);
    }

    const localData = await this.storage.getLocal(['ui', 'document', 'workspace']);
    const storedUI: unknown = localData['ui'];
    if (storedUI && typeof storedUI === 'object') {
      Object.assign(this.state.ui, storedUI);
    }
    const storedDoc: unknown = localData['document'];
    if (storedDoc && typeof storedDoc === 'object') {
      Object.assign(this.state.document, storedDoc);
    }
    const storedWorkspace: unknown = localData['workspace'];
    if (storedWorkspace && typeof storedWorkspace === 'object') {
      const ws = storedWorkspace as Partial<WorkspaceState>;
      if (typeof ws.sidebarVisible === 'boolean') {
        this.workspace.sidebarVisible = ws.sidebarVisible;
      }
      if (typeof ws.sidebarWidth === 'number') {
        this.workspace.sidebarWidth = ws.sidebarWidth;
      }
      if (typeof ws.statusBarVisible === 'boolean') {
        this.workspace.statusBarVisible = ws.statusBarVisible;
      }
      if (typeof ws.openFolderPath === 'string') {
        this.workspace.openFolderPath = ws.openFolderPath;
      }
      if (typeof ws.tabBarVisible === 'boolean') {
        this.workspace.tabBarVisible = ws.tabBarVisible;
      }
      if (typeof ws.headerBarVisible === 'boolean') {
        this.workspace.headerBarVisible = ws.headerBarVisible;
      }
      if (Array.isArray(ws.tabGroups)) {
        this.workspace.tabGroups = ws.tabGroups;
      }
    }
  }

  getState(): AppState {
    return { ...this.state };
  }

  async updatePreferences(prefs: Partial<Preferences>): Promise<void> {
    Object.assign(this.state.preferences, prefs);
    await this.storage.setSync({ preferences: this.state.preferences });
  }

  getPreferences(): AppState['preferences'] {
    return { ...this.state.preferences };
  }

  // Workspace methods

  getWorkspaceState(): WorkspaceState {
    return structuredClone(this.workspace);
  }

  openTab(filePath: string): TabState {
    // Deduplicate: if file already open, just activate it
    const existing = this.workspace.tabs.find((t) => t.filePath === filePath);
    if (existing) {
      this.workspace.activeTabId = existing.id;
      this.persistWorkspace();
      return { ...existing };
    }

    const tab: TabState = {
      id: generateTabId(),
      filePath,
      title: basename(filePath),
      scrollPosition: 0,
      renderState: 'pending',
    };

    this.workspace.tabs.push(tab);
    this.workspace.activeTabId = tab.id;
    this.persistWorkspace();
    return { ...tab };
  }

  closeTab(tabId: string): void {
    const index = this.workspace.tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    this.workspace.tabs.splice(index, 1);

    // Remove from any group
    for (let i = this.workspace.tabGroups.length - 1; i >= 0; i--) {
      const group = this.workspace.tabGroups[i];
      group.tabIds = group.tabIds.filter((id) => id !== tabId);
      if (group.tabIds.length === 0) {
        this.workspace.tabGroups.splice(i, 1);
      }
    }

    if (this.workspace.activeTabId === tabId) {
      if (this.workspace.tabs.length === 0) {
        this.workspace.activeTabId = null;
      } else {
        const newIndex = Math.min(index, this.workspace.tabs.length - 1);
        this.workspace.activeTabId = this.workspace.tabs[newIndex].id;
      }
    }

    this.persistWorkspace();
  }

  setActiveTab(tabId: string): void {
    const tab = this.workspace.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    this.workspace.activeTabId = tabId;
    this.persistWorkspace();
  }

  updateTabMetadata(tabId: string, metadata: Partial<TabState>): void {
    const tab = this.workspace.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    Object.assign(tab, metadata);
    // Don't overwrite id or filePath
    tab.id = tabId;
    this.persistWorkspace();
  }

  updateTabScrollPosition(tabId: string, position: number): void {
    const tab = this.workspace.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    tab.scrollPosition = position;
    this.persistWorkspace();
  }

  setSidebarVisible(visible: boolean): void {
    this.workspace.sidebarVisible = visible;
    this.persistWorkspace();
  }

  setSidebarWidth(width: number): void {
    this.workspace.sidebarWidth = Math.max(50, Math.min(800, width));
    this.persistWorkspace();
  }

  setOpenFolder(path: string | null): void {
    this.workspace.openFolderPath = path;
    this.persistWorkspace();
  }

  setTabBarVisible(visible: boolean): void {
    this.workspace.tabBarVisible = visible;
    this.persistWorkspace();
  }

  setHeaderBarVisible(visible: boolean): void {
    this.workspace.headerBarVisible = visible;
    this.persistWorkspace();
  }

  // Tab group methods

  createTabGroup(name: string, color: TabGroupColor, tabIds: string[]): TabGroupState {
    const group: TabGroupState = {
      id: `group-${Date.now()}-${++tabCounter}`,
      name,
      color,
      collapsed: false,
      tabIds,
    };
    this.workspace.tabGroups.push(group);
    this.persistWorkspace();
    return structuredClone(group);
  }

  updateTabGroup(
    groupId: string,
    updates: Partial<Pick<TabGroupState, 'name' | 'color' | 'collapsed' | 'tabIds'>>
  ): void {
    const group = this.workspace.tabGroups.find((g) => g.id === groupId);
    if (!group) return;
    if (updates.name !== undefined) group.name = updates.name;
    if (updates.color !== undefined) group.color = updates.color;
    if (updates.collapsed !== undefined) group.collapsed = updates.collapsed;
    if (updates.tabIds !== undefined) group.tabIds = updates.tabIds;
    this.persistWorkspace();
  }

  deleteTabGroup(groupId: string): void {
    const index = this.workspace.tabGroups.findIndex((g) => g.id === groupId);
    if (index === -1) return;
    this.workspace.tabGroups.splice(index, 1);
    this.persistWorkspace();
  }

  private persistWorkspace(): void {
    void this.storage.setLocal({
      workspace: {
        sidebarVisible: this.workspace.sidebarVisible,
        sidebarWidth: this.workspace.sidebarWidth,
        statusBarVisible: this.workspace.statusBarVisible,
        tabBarVisible: this.workspace.tabBarVisible,
        headerBarVisible: this.workspace.headerBarVisible,
        openFolderPath: this.workspace.openFolderPath,
        tabs: this.workspace.tabs.map((t) => ({ filePath: t.filePath })),
        activeTabId: this.workspace.activeTabId,
        tabGroups: this.workspace.tabGroups,
      },
    });
  }
}

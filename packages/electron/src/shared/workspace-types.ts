export interface TabState {
  id: string;
  filePath: string;
  title: string;
  scrollPosition: number;
  renderState: 'pending' | 'rendering' | 'complete' | 'error';
  wordCount?: number;
  headingCount?: number;
  diagramCount?: number;
  codeBlockCount?: number;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: DirectoryEntry[];
}

export interface WorkspaceState {
  tabs: TabState[];
  activeTabId: string | null;
  sidebarVisible: boolean;
  sidebarWidth: number;
  openFolderPath: string | null;
  statusBarVisible: boolean;
}

export const DEFAULT_WORKSPACE_STATE: WorkspaceState = {
  tabs: [],
  activeTabId: null,
  sidebarVisible: true,
  sidebarWidth: 250,
  openFolderPath: null,
  statusBarVisible: true,
};

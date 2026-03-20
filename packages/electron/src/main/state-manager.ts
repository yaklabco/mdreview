import type { AppState, Preferences } from '@mdview/core';
import type { StorageAdapter } from '@mdview/core';

const DEFAULT_PREFERENCES: AppState['preferences'] = {
  theme: 'github-light',
  autoTheme: true,
  lightTheme: 'github-light',
  darkTheme: 'github-dark',
  syntaxTheme: 'github',
  autoReload: true,
  lineNumbers: false,
  enableHtml: false,
  syncTabs: false,
  logLevel: 'error',
  showToc: false,
  tocMaxDepth: 6,
  tocAutoCollapse: false,
  tocPosition: 'left',
  tocStyle: 'floating',
  commentsEnabled: true,
  commentAuthor: '',
  blockedSites: [],
};

const DEFAULT_STATE: AppState = {
  preferences: { ...DEFAULT_PREFERENCES },
  document: {
    path: '',
    content: '',
    scrollPosition: 0,
    renderState: 'pending',
  },
  ui: {
    theme: null,
    maximizedDiagram: null,
    visibleDiagrams: new Set(),
    tocVisible: false,
  },
};

export class StateManager {
  private state: AppState = structuredClone(DEFAULT_STATE);

  constructor(private storage: StorageAdapter) {}

  async initialize(): Promise<void> {
    const syncData = await this.storage.getSync('preferences');
    const storedPrefs = syncData.preferences;
    if (storedPrefs && typeof storedPrefs === 'object') {
      Object.assign(this.state.preferences, storedPrefs);
    }

    const localData = await this.storage.getLocal(['ui', 'document']);
    const storedUI = localData.ui;
    if (storedUI && typeof storedUI === 'object') {
      Object.assign(this.state.ui, storedUI);
    }
    const storedDoc = localData.document;
    if (storedDoc && typeof storedDoc === 'object') {
      Object.assign(this.state.document, storedDoc);
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
}

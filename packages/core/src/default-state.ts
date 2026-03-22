import type { AppState } from './types/index';

export const DEFAULT_PREFERENCES: AppState['preferences'] = {
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
  commentsEnabled: true,
  commentAuthor: '',
  blockedSites: [],
  showAllFiles: false,
  iconTheme: 'lucide',
};

export const DEFAULT_STATE: AppState = {
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

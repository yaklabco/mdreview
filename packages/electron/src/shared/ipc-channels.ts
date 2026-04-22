export const IPC_CHANNELS = {
  GET_STATE: 'mdreview:get-state',
  UPDATE_PREFERENCES: 'mdreview:update-preferences',
  CACHE_GENERATE_KEY: 'mdreview:cache-generate-key',
  CACHE_GET: 'mdreview:cache-get',
  CACHE_SET: 'mdreview:cache-set',
  READ_FILE: 'mdreview:read-file',
  WRITE_FILE: 'mdreview:write-file',
  CHECK_FILE_CHANGED: 'mdreview:check-file-changed',
  WATCH_FILE: 'mdreview:watch-file',
  UNWATCH_FILE: 'mdreview:unwatch-file',
  GET_USERNAME: 'mdreview:get-username',
  SAVE_FILE: 'mdreview:save-file',
  PRINT_TO_PDF: 'mdreview:print-to-pdf',
  GET_OPEN_FILE_PATH: 'mdreview:get-open-file-path',

  // File dialogs
  SHOW_OPEN_FILE_DIALOG: 'mdreview:show-open-file-dialog',
  SHOW_OPEN_FOLDER_DIALOG: 'mdreview:show-open-folder-dialog',
  GET_RECENT_FILES: 'mdreview:get-recent-files',
  ADD_RECENT_FILE: 'mdreview:add-recent-file',
  CLEAR_RECENT_FILES: 'mdreview:clear-recent-files',

  // Workspace state
  GET_WORKSPACE_STATE: 'mdreview:get-workspace-state',
  OPEN_TAB: 'mdreview:open-tab',
  CLOSE_TAB: 'mdreview:close-tab',
  SET_ACTIVE_TAB: 'mdreview:set-active-tab',
  UPDATE_TAB_METADATA: 'mdreview:update-tab-metadata',
  UPDATE_TAB_SCROLL: 'mdreview:update-tab-scroll',
  SET_SIDEBAR_VISIBLE: 'mdreview:set-sidebar-visible',
  SET_SIDEBAR_WIDTH: 'mdreview:set-sidebar-width',
  SET_TAB_BAR_VISIBLE: 'mdreview:set-tab-bar-visible',
  SET_HEADER_BAR_VISIBLE: 'mdreview:set-header-bar-visible',
  SET_OPEN_FOLDER: 'mdreview:set-open-folder',
  OPEN_EXTERNAL: 'mdreview:open-external',

  // Context menu
  SHOW_CONTEXT_MENU: 'mdreview:show-context-menu',
  REVEAL_IN_FINDER: 'mdreview:reveal-in-finder',

  // Directory
  LIST_DIRECTORY: 'mdreview:list-directory',
  WATCH_DIRECTORY: 'mdreview:watch-directory',
  UNWATCH_DIRECTORY: 'mdreview:unwatch-directory',

  // Tab groups
  CREATE_TAB_GROUP: 'mdreview:create-tab-group',
  UPDATE_TAB_GROUP: 'mdreview:update-tab-group',
  DELETE_TAB_GROUP: 'mdreview:delete-tab-group',

  // Git
  GIT_IS_REPO: 'mdreview:git-is-repo',
  GIT_GET_BRANCH: 'mdreview:git-get-branch',
  GIT_LIST_BRANCHES: 'mdreview:git-list-branches',
  GIT_CHECKOUT: 'mdreview:git-checkout',
  GIT_STATUS: 'mdreview:git-status',
  GIT_STAGE: 'mdreview:git-stage',
  GIT_UNSTAGE: 'mdreview:git-unstage',
  GIT_COMMIT: 'mdreview:git-commit',

  // Events from main → renderer
  FILE_CHANGED: 'mdreview:file-changed',
  PREFERENCES_UPDATED: 'mdreview:preferences-updated',
  THEME_CHANGED: 'mdreview:theme-changed',
  OPEN_FILE: 'mdreview:open-file',
  OPEN_FOLDER: 'mdreview:open-folder',
  MENU_COMMAND: 'mdreview:menu-command',
  WORKSPACE_UPDATED: 'mdreview:workspace-updated',
  TAB_OPENED: 'mdreview:tab-opened',
  TAB_CLOSED: 'mdreview:tab-closed',
  ACTIVE_TAB_CHANGED: 'mdreview:active-tab-changed',
  DIRECTORY_CHANGED: 'mdreview:directory-changed',
} as const;

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export const IPC_CHANNELS = {
  GET_STATE: 'mdview:get-state',
  UPDATE_PREFERENCES: 'mdview:update-preferences',
  CACHE_GENERATE_KEY: 'mdview:cache-generate-key',
  CACHE_GET: 'mdview:cache-get',
  CACHE_SET: 'mdview:cache-set',
  READ_FILE: 'mdview:read-file',
  WRITE_FILE: 'mdview:write-file',
  CHECK_FILE_CHANGED: 'mdview:check-file-changed',
  WATCH_FILE: 'mdview:watch-file',
  UNWATCH_FILE: 'mdview:unwatch-file',
  GET_USERNAME: 'mdview:get-username',
  SAVE_FILE: 'mdview:save-file',
  PRINT_TO_PDF: 'mdview:print-to-pdf',
  GET_OPEN_FILE_PATH: 'mdview:get-open-file-path',

  // File dialogs
  SHOW_OPEN_FILE_DIALOG: 'mdview:show-open-file-dialog',
  SHOW_OPEN_FOLDER_DIALOG: 'mdview:show-open-folder-dialog',
  GET_RECENT_FILES: 'mdview:get-recent-files',
  ADD_RECENT_FILE: 'mdview:add-recent-file',
  CLEAR_RECENT_FILES: 'mdview:clear-recent-files',

  // Workspace state
  GET_WORKSPACE_STATE: 'mdview:get-workspace-state',
  OPEN_TAB: 'mdview:open-tab',
  CLOSE_TAB: 'mdview:close-tab',
  SET_ACTIVE_TAB: 'mdview:set-active-tab',
  UPDATE_TAB_METADATA: 'mdview:update-tab-metadata',
  UPDATE_TAB_SCROLL: 'mdview:update-tab-scroll',
  SET_SIDEBAR_VISIBLE: 'mdview:set-sidebar-visible',
  SET_SIDEBAR_WIDTH: 'mdview:set-sidebar-width',
  SET_OPEN_FOLDER: 'mdview:set-open-folder',
  OPEN_EXTERNAL: 'mdview:open-external',

  // Directory
  LIST_DIRECTORY: 'mdview:list-directory',
  WATCH_DIRECTORY: 'mdview:watch-directory',
  UNWATCH_DIRECTORY: 'mdview:unwatch-directory',

  // Events from main → renderer
  FILE_CHANGED: 'mdview:file-changed',
  PREFERENCES_UPDATED: 'mdview:preferences-updated',
  THEME_CHANGED: 'mdview:theme-changed',
  OPEN_FILE: 'mdview:open-file',
  OPEN_FOLDER: 'mdview:open-folder',
  MENU_COMMAND: 'mdview:menu-command',
  WORKSPACE_UPDATED: 'mdview:workspace-updated',
  TAB_OPENED: 'mdview:tab-opened',
  TAB_CLOSED: 'mdview:tab-closed',
  ACTIVE_TAB_CHANGED: 'mdview:active-tab-changed',
  DIRECTORY_CHANGED: 'mdview:directory-changed',
} as const;

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

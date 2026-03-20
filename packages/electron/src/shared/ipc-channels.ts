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

  // Events from main → renderer
  FILE_CHANGED: 'mdview:file-changed',
  PREFERENCES_UPDATED: 'mdview:preferences-updated',
  THEME_CHANGED: 'mdview:theme-changed',
} as const;

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

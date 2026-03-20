import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS } from './ipc-channels';

describe('IPC_CHANNELS', () => {
  it('should have all expected channels', () => {
    expect(IPC_CHANNELS.GET_STATE).toBe('mdview:get-state');
    expect(IPC_CHANNELS.UPDATE_PREFERENCES).toBe('mdview:update-preferences');
    expect(IPC_CHANNELS.CACHE_GENERATE_KEY).toBe('mdview:cache-generate-key');
    expect(IPC_CHANNELS.CACHE_GET).toBe('mdview:cache-get');
    expect(IPC_CHANNELS.CACHE_SET).toBe('mdview:cache-set');
    expect(IPC_CHANNELS.READ_FILE).toBe('mdview:read-file');
    expect(IPC_CHANNELS.WRITE_FILE).toBe('mdview:write-file');
    expect(IPC_CHANNELS.CHECK_FILE_CHANGED).toBe('mdview:check-file-changed');
    expect(IPC_CHANNELS.WATCH_FILE).toBe('mdview:watch-file');
    expect(IPC_CHANNELS.UNWATCH_FILE).toBe('mdview:unwatch-file');
    expect(IPC_CHANNELS.GET_USERNAME).toBe('mdview:get-username');
    expect(IPC_CHANNELS.SAVE_FILE).toBe('mdview:save-file');
    expect(IPC_CHANNELS.PRINT_TO_PDF).toBe('mdview:print-to-pdf');
    expect(IPC_CHANNELS.GET_OPEN_FILE_PATH).toBe('mdview:get-open-file-path');
  });

  it('should have event channels for main → renderer communication', () => {
    expect(IPC_CHANNELS.FILE_CHANGED).toBe('mdview:file-changed');
    expect(IPC_CHANNELS.PREFERENCES_UPDATED).toBe('mdview:preferences-updated');
    expect(IPC_CHANNELS.THEME_CHANGED).toBe('mdview:theme-changed');
  });

  it('should have unique channel names', () => {
    const values = Object.values(IPC_CHANNELS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('should prefix all channels with mdview:', () => {
    for (const value of Object.values(IPC_CHANNELS)) {
      expect(value).toMatch(/^mdview:/);
    }
  });
});

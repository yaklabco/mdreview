import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS } from './ipc-channels';

describe('IPC_CHANNELS', () => {
  it('should have all expected channels', () => {
    expect(IPC_CHANNELS.GET_STATE).toBe('mdreview:get-state');
    expect(IPC_CHANNELS.UPDATE_PREFERENCES).toBe('mdreview:update-preferences');
    expect(IPC_CHANNELS.CACHE_GENERATE_KEY).toBe('mdreview:cache-generate-key');
    expect(IPC_CHANNELS.CACHE_GET).toBe('mdreview:cache-get');
    expect(IPC_CHANNELS.CACHE_SET).toBe('mdreview:cache-set');
    expect(IPC_CHANNELS.READ_FILE).toBe('mdreview:read-file');
    expect(IPC_CHANNELS.WRITE_FILE).toBe('mdreview:write-file');
    expect(IPC_CHANNELS.CHECK_FILE_CHANGED).toBe('mdreview:check-file-changed');
    expect(IPC_CHANNELS.WATCH_FILE).toBe('mdreview:watch-file');
    expect(IPC_CHANNELS.UNWATCH_FILE).toBe('mdreview:unwatch-file');
    expect(IPC_CHANNELS.GET_USERNAME).toBe('mdreview:get-username');
    expect(IPC_CHANNELS.SAVE_FILE).toBe('mdreview:save-file');
    expect(IPC_CHANNELS.PRINT_TO_PDF).toBe('mdreview:print-to-pdf');
    expect(IPC_CHANNELS.GET_OPEN_FILE_PATH).toBe('mdreview:get-open-file-path');
  });

  it('should have event channels for main → renderer communication', () => {
    expect(IPC_CHANNELS.FILE_CHANGED).toBe('mdreview:file-changed');
    expect(IPC_CHANNELS.PREFERENCES_UPDATED).toBe('mdreview:preferences-updated');
    expect(IPC_CHANNELS.THEME_CHANGED).toBe('mdreview:theme-changed');
  });

  it('should have unique channel names', () => {
    const values = Object.values(IPC_CHANNELS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('should prefix all channels with mdreview:', () => {
    for (const value of Object.values(IPC_CHANNELS)) {
      expect(value).toMatch(/^mdreview:/);
    }
  });

  it('should have all git channels', () => {
    expect(IPC_CHANNELS.GIT_IS_REPO).toBe('mdreview:git-is-repo');
    expect(IPC_CHANNELS.GIT_GET_BRANCH).toBe('mdreview:git-get-branch');
    expect(IPC_CHANNELS.GIT_LIST_BRANCHES).toBe('mdreview:git-list-branches');
    expect(IPC_CHANNELS.GIT_CHECKOUT).toBe('mdreview:git-checkout');
    expect(IPC_CHANNELS.GIT_STATUS).toBe('mdreview:git-status');
    expect(IPC_CHANNELS.GIT_STAGE).toBe('mdreview:git-stage');
    expect(IPC_CHANNELS.GIT_UNSTAGE).toBe('mdreview:git-unstage');
    expect(IPC_CHANNELS.GIT_COMMIT).toBe('mdreview:git-commit');
    expect(IPC_CHANNELS.GIT_STASH).toBe('mdreview:git-stash');
  });

  it('should follow mdreview:git-* pattern for all git channels', () => {
    const gitChannelKeys = Object.keys(IPC_CHANNELS).filter((key) => key.startsWith('GIT_'));
    expect(gitChannelKeys.length).toBe(9);
    for (const key of gitChannelKeys) {
      const value = IPC_CHANNELS[key as keyof typeof IPC_CHANNELS];
      expect(value).toMatch(/^mdreview:git-/);
    }
  });
});

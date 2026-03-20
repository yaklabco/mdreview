import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from './state-manager';
import { NoopStorageAdapter } from '@mdview/core';

describe('StateManager', () => {
  let storage: NoopStorageAdapter;
  let manager: StateManager;

  beforeEach(() => {
    storage = new NoopStorageAdapter();
    manager = new StateManager(storage);
  });

  describe('getState', () => {
    it('should return default state before initialization', () => {
      const state = manager.getState();
      expect(state.preferences.theme).toBe('github-light');
      expect(state.preferences.autoReload).toBe(true);
      expect(state.document.path).toBe('');
      expect(state.document.renderState).toBe('pending');
    });

    it('should return a copy, not the internal state', () => {
      const state1 = manager.getState();
      const state2 = manager.getState();
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('initialize', () => {
    it('should load preferences from sync storage', async () => {
      await storage.setSync({
        preferences: { theme: 'github-dark', autoReload: false },
      });
      await manager.initialize();
      const state = manager.getState();
      expect(state.preferences.theme).toBe('github-dark');
      expect(state.preferences.autoReload).toBe(false);
    });

    it('should preserve defaults for missing preferences', async () => {
      await storage.setSync({ preferences: { theme: 'monokai' } });
      await manager.initialize();
      const state = manager.getState();
      expect(state.preferences.theme).toBe('monokai');
      expect(state.preferences.lineNumbers).toBe(false);
      expect(state.preferences.syntaxTheme).toBe('github');
    });

    it('should load document state from local storage', async () => {
      await storage.setLocal({
        document: { path: '/tmp/test.md', scrollPosition: 100 },
      });
      await manager.initialize();
      const state = manager.getState();
      expect(state.document.path).toBe('/tmp/test.md');
      expect(state.document.scrollPosition).toBe(100);
    });

    it('should handle empty storage gracefully', async () => {
      await manager.initialize();
      const state = manager.getState();
      expect(state.preferences.theme).toBe('github-light');
    });
  });

  describe('updatePreferences', () => {
    it('should merge new preferences', async () => {
      await manager.updatePreferences({ theme: 'catppuccin-mocha' });
      const state = manager.getState();
      expect(state.preferences.theme).toBe('catppuccin-mocha');
      expect(state.preferences.autoReload).toBe(true);
    });

    it('should persist to sync storage', async () => {
      await manager.updatePreferences({ lineNumbers: true });
      const stored = await storage.getSync('preferences');
      const prefs = stored.preferences as Record<string, unknown>;
      expect(prefs.lineNumbers).toBe(true);
    });
  });

  describe('getPreferences', () => {
    it('should return current preferences', () => {
      const prefs = manager.getPreferences();
      expect(prefs.theme).toBe('github-light');
    });

    it('should return a copy', () => {
      const p1 = manager.getPreferences();
      const p2 = manager.getPreferences();
      expect(p1).not.toBe(p2);
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from './state-manager';
import { NoopStorageAdapter } from '@mdview/core/node';

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

    it('should default enableHtml to true for Electron', () => {
      const state = manager.getState();
      expect(state.preferences.enableHtml).toBe(true);
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

  describe('workspace state', () => {
    it('should return default workspace state', () => {
      const ws = manager.getWorkspaceState();
      expect(ws.tabs).toEqual([]);
      expect(ws.activeTabId).toBeNull();
      expect(ws.sidebarVisible).toBe(true);
      expect(ws.statusBarVisible).toBe(true);
    });

    it('should return a deep copy of workspace state', () => {
      const ws1 = manager.getWorkspaceState();
      const ws2 = manager.getWorkspaceState();
      expect(ws1).not.toBe(ws2);
      expect(ws1).toEqual(ws2);
    });

    describe('openTab', () => {
      it('should create a new tab and set it active', () => {
        const tab = manager.openTab('/tmp/test.md');
        expect(tab.filePath).toBe('/tmp/test.md');
        expect(tab.title).toBe('test.md');
        expect(tab.scrollPosition).toBe(0);
        expect(tab.renderState).toBe('pending');

        const ws = manager.getWorkspaceState();
        expect(ws.tabs).toHaveLength(1);
        expect(ws.activeTabId).toBe(tab.id);
      });

      it('should deduplicate by file path', () => {
        const tab1 = manager.openTab('/tmp/test.md');
        const tab2 = manager.openTab('/tmp/test.md');
        expect(tab2.id).toBe(tab1.id);

        const ws = manager.getWorkspaceState();
        expect(ws.tabs).toHaveLength(1);
      });

      it('should open multiple different files', () => {
        manager.openTab('/tmp/a.md');
        manager.openTab('/tmp/b.md');
        const tab3 = manager.openTab('/tmp/c.md');

        const ws = manager.getWorkspaceState();
        expect(ws.tabs).toHaveLength(3);
        expect(ws.activeTabId).toBe(tab3.id);
      });
    });

    describe('closeTab', () => {
      it('should remove the tab', () => {
        const tab = manager.openTab('/tmp/test.md');
        manager.closeTab(tab.id);

        const ws = manager.getWorkspaceState();
        expect(ws.tabs).toHaveLength(0);
        expect(ws.activeTabId).toBeNull();
      });

      it('should activate adjacent tab when closing active tab', () => {
        const tab1 = manager.openTab('/tmp/a.md');
        manager.openTab('/tmp/b.md');
        manager.openTab('/tmp/c.md');

        // Activate middle tab then close it
        manager.setActiveTab(manager.getWorkspaceState().tabs[1].id);
        manager.closeTab(manager.getWorkspaceState().tabs[1].id);

        const ws = manager.getWorkspaceState();
        expect(ws.tabs).toHaveLength(2);
        // Should activate the tab at the same index (which is now c.md)
        expect(ws.activeTabId).not.toBe(tab1.id);
      });

      it('should activate previous tab when closing last tab in list', () => {
        manager.openTab('/tmp/a.md');
        const tab2 = manager.openTab('/tmp/b.md');

        // tab2 is active (last opened), close it
        manager.closeTab(tab2.id);

        const ws = manager.getWorkspaceState();
        expect(ws.tabs).toHaveLength(1);
        expect(ws.activeTabId).toBe(ws.tabs[0].id);
      });

      it('should ignore closing nonexistent tab', () => {
        manager.openTab('/tmp/a.md');
        manager.closeTab('nonexistent');
        expect(manager.getWorkspaceState().tabs).toHaveLength(1);
      });
    });

    describe('setActiveTab', () => {
      it('should change the active tab', () => {
        const tab1 = manager.openTab('/tmp/a.md');
        manager.openTab('/tmp/b.md');

        manager.setActiveTab(tab1.id);
        expect(manager.getWorkspaceState().activeTabId).toBe(tab1.id);
      });

      it('should ignore nonexistent tab id', () => {
        const tab1 = manager.openTab('/tmp/a.md');
        manager.setActiveTab('nonexistent');
        expect(manager.getWorkspaceState().activeTabId).toBe(tab1.id);
      });
    });

    describe('updateTabMetadata', () => {
      it('should update tab metadata', () => {
        const tab = manager.openTab('/tmp/test.md');
        manager.updateTabMetadata(tab.id, {
          wordCount: 100,
          headingCount: 5,
          renderState: 'complete',
        });

        const ws = manager.getWorkspaceState();
        expect(ws.tabs[0].wordCount).toBe(100);
        expect(ws.tabs[0].headingCount).toBe(5);
        expect(ws.tabs[0].renderState).toBe('complete');
      });

      it('should not overwrite tab id', () => {
        const tab = manager.openTab('/tmp/test.md');
        manager.updateTabMetadata(tab.id, { id: 'hacked' } as never);
        expect(manager.getWorkspaceState().tabs[0].id).toBe(tab.id);
      });
    });

    describe('updateTabScrollPosition', () => {
      it('should update scroll position', () => {
        const tab = manager.openTab('/tmp/test.md');
        manager.updateTabScrollPosition(tab.id, 500);
        expect(manager.getWorkspaceState().tabs[0].scrollPosition).toBe(500);
      });
    });

    describe('setSidebarVisible', () => {
      it('should toggle sidebar visibility', () => {
        manager.setSidebarVisible(false);
        expect(manager.getWorkspaceState().sidebarVisible).toBe(false);
        manager.setSidebarVisible(true);
        expect(manager.getWorkspaceState().sidebarVisible).toBe(true);
      });
    });

    describe('setSidebarWidth', () => {
      it('should update sidebar width', () => {
        manager.setSidebarWidth(300);
        expect(manager.getWorkspaceState().sidebarWidth).toBe(300);
      });

      it('should clamp width to minimum 50', () => {
        manager.setSidebarWidth(10);
        expect(manager.getWorkspaceState().sidebarWidth).toBe(50);
      });

      it('should clamp width to maximum 800', () => {
        manager.setSidebarWidth(1000);
        expect(manager.getWorkspaceState().sidebarWidth).toBe(800);
      });
    });

    describe('setOpenFolder', () => {
      it('should set open folder path', () => {
        manager.setOpenFolder('/tmp/docs');
        expect(manager.getWorkspaceState().openFolderPath).toBe('/tmp/docs');
      });

      it('should allow clearing folder path', () => {
        manager.setOpenFolder('/tmp/docs');
        manager.setOpenFolder(null);
        expect(manager.getWorkspaceState().openFolderPath).toBeNull();
      });
    });

    describe('workspace persistence', () => {
      it('should persist workspace settings on change', async () => {
        manager.setSidebarVisible(false);
        // Allow async persistence to complete
        await new Promise((r) => setTimeout(r, 10));
        const stored = await storage.getLocal(['workspace']);
        expect(stored.workspace).toBeDefined();
      });
    });

    describe('tab groups', () => {
      it('should default to empty tab groups', () => {
        const ws = manager.getWorkspaceState();
        expect(ws.tabGroups).toEqual([]);
      });

      it('should create a tab group', () => {
        const tab1 = manager.openTab('/tmp/a.md');
        const tab2 = manager.openTab('/tmp/b.md');

        const group = manager.createTabGroup('Research', 'blue', [tab1.id, tab2.id]);
        expect(group.id).toBeTruthy();
        expect(group.name).toBe('Research');
        expect(group.color).toBe('blue');
        expect(group.collapsed).toBe(false);
        expect(group.tabIds).toEqual([tab1.id, tab2.id]);

        const ws = manager.getWorkspaceState();
        expect(ws.tabGroups).toHaveLength(1);
      });

      it('should update a tab group', () => {
        const tab = manager.openTab('/tmp/a.md');
        const group = manager.createTabGroup('Research', 'blue', [tab.id]);

        manager.updateTabGroup(group.id, { name: 'Docs', color: 'green', collapsed: true });

        const ws = manager.getWorkspaceState();
        expect(ws.tabGroups[0].name).toBe('Docs');
        expect(ws.tabGroups[0].color).toBe('green');
        expect(ws.tabGroups[0].collapsed).toBe(true);
      });

      it('should delete a tab group', () => {
        const tab = manager.openTab('/tmp/a.md');
        const group = manager.createTabGroup('Research', 'blue', [tab.id]);

        manager.deleteTabGroup(group.id);

        const ws = manager.getWorkspaceState();
        expect(ws.tabGroups).toHaveLength(0);
      });

      it('should ignore updates to nonexistent group', () => {
        manager.updateTabGroup('nonexistent', { name: 'Nope' });
        expect(manager.getWorkspaceState().tabGroups).toHaveLength(0);
      });

      it('should ignore deletion of nonexistent group', () => {
        const tab = manager.openTab('/tmp/a.md');
        manager.createTabGroup('Research', 'blue', [tab.id]);
        manager.deleteTabGroup('nonexistent');
        expect(manager.getWorkspaceState().tabGroups).toHaveLength(1);
      });

      it('should remove tab from groups when tab is closed', () => {
        const tab1 = manager.openTab('/tmp/a.md');
        const tab2 = manager.openTab('/tmp/b.md');
        manager.createTabGroup('Research', 'blue', [tab1.id, tab2.id]);

        manager.closeTab(tab1.id);

        const ws = manager.getWorkspaceState();
        expect(ws.tabGroups[0].tabIds).toEqual([tab2.id]);
      });

      it('should delete group when last tab is closed', () => {
        const tab = manager.openTab('/tmp/a.md');
        manager.createTabGroup('Research', 'blue', [tab.id]);

        manager.closeTab(tab.id);

        const ws = manager.getWorkspaceState();
        expect(ws.tabGroups).toHaveLength(0);
      });

      it('should persist tab groups', async () => {
        const tab = manager.openTab('/tmp/a.md');
        manager.createTabGroup('Research', 'blue', [tab.id]);

        await new Promise((r) => setTimeout(r, 10));
        const stored = await storage.getLocal(['workspace']);
        const ws = stored.workspace as Record<string, unknown>;
        expect(ws.tabGroups).toBeDefined();
      });

      it('should restore tab groups from storage', async () => {
        const tab = manager.openTab('/tmp/a.md');
        await storage.setLocal({
          workspace: {
            tabGroups: [
              { id: 'g-1', name: 'Saved', color: 'red', collapsed: false, tabIds: [tab.id] },
            ],
          },
        });
        // Create a new manager instance and initialize
        const manager2 = new StateManager(storage);
        await manager2.initialize();
        const ws = manager2.getWorkspaceState();
        expect(ws.tabGroups).toHaveLength(1);
        expect(ws.tabGroups[0].name).toBe('Saved');
      });
    });
  });
});

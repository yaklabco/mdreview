import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TabManager } from './tab-manager';

// Mock ResizeObserver for jsdom
class MockResizeObserver {
  callback: ResizeObserverCallback;
  static instances: MockResizeObserver[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}

  trigger(entries: Array<{ contentRect: { width: number } }>) {
    this.callback(
      entries.map((e) => ({ contentRect: e.contentRect }) as ResizeObserverEntry),
      this as unknown as ResizeObserver
    );
  }
}

describe('TabManager', () => {
  let tabManager: TabManager;
  let container: HTMLElement;

  beforeEach(() => {
    MockResizeObserver.instances = [];
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    document.body.innerHTML = '<div id="mdview-tab-bar"></div><div id="mdview-content-area"></div>';
    container = document.getElementById('mdview-tab-bar')!;
    tabManager = new TabManager();
    tabManager.render(container);
  });

  afterEach(() => {
    tabManager.dispose();
  });

  it('should create a tab', () => {
    tabManager.createTab('tab-1', '/tmp/test.md', 'test.md');
    expect(tabManager.getTabCount()).toBe(1);
  });

  it('should activate a tab on creation', () => {
    tabManager.createTab('tab-1', '/tmp/test.md', 'test.md');
    expect(tabManager.getActiveTab()).toBe('tab-1');
  });

  it('should render tab button in the tab bar', () => {
    tabManager.createTab('tab-1', '/tmp/test.md', 'test.md');
    const tabBtn = container.querySelector('[data-tab-id="tab-1"]');
    expect(tabBtn).not.toBeNull();
    expect(tabBtn?.textContent).toContain('test.md');
  });

  it('should switch active tab', () => {
    tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
    tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');
    tabManager.activateTab('tab-1');
    expect(tabManager.getActiveTab()).toBe('tab-1');
  });

  it('should apply active class to active tab button', () => {
    tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
    tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');
    tabManager.activateTab('tab-1');

    const tab1Btn = container.querySelector('[data-tab-id="tab-1"]');
    const tab2Btn = container.querySelector('[data-tab-id="tab-2"]');
    expect(tab1Btn?.classList.contains('active')).toBe(true);
    expect(tab2Btn?.classList.contains('active')).toBe(false);
  });

  it('should close a tab', () => {
    tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
    tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');
    tabManager.closeTab('tab-1');
    expect(tabManager.getTabCount()).toBe(1);

    const tab1Btn = container.querySelector('[data-tab-id="tab-1"]');
    expect(tab1Btn).toBeNull();
  });

  it('should call onTabClick callback when tab button is clicked', () => {
    const onTabClick = vi.fn();
    tabManager.onTabClick(onTabClick);

    tabManager.createTab('tab-1', '/tmp/test.md', 'test.md');
    const tabBtn = container.querySelector('[data-tab-id="tab-1"]') as HTMLElement;
    tabBtn.click();

    expect(onTabClick).toHaveBeenCalledWith('tab-1');
  });

  it('should call onTabClose callback when close button is clicked', () => {
    const onTabClose = vi.fn();
    tabManager.onTabClose(onTabClose);

    tabManager.createTab('tab-1', '/tmp/test.md', 'test.md');
    const closeBtn = container.querySelector('[data-tab-id="tab-1"] .tab-close') as HTMLElement;
    closeBtn.click();

    expect(onTabClose).toHaveBeenCalledWith('tab-1');
  });

  it('should call onTabClose on middle-click', () => {
    const onTabClose = vi.fn();
    tabManager.onTabClose(onTabClose);

    tabManager.createTab('tab-1', '/tmp/test.md', 'test.md');
    const tabBtn = container.querySelector('[data-tab-id="tab-1"]') as HTMLElement;
    tabBtn.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));

    expect(onTabClose).toHaveBeenCalledWith('tab-1');
  });

  it('should return null for active tab when empty', () => {
    expect(tabManager.getActiveTab()).toBeNull();
  });

  it('should get content container for a tab', () => {
    const contentArea = document.getElementById('mdview-content-area')!;
    tabManager.setContentArea(contentArea);
    tabManager.createTab('tab-1', '/tmp/test.md', 'test.md');
    const tabContainer = tabManager.getTabContainer('tab-1');
    expect(tabContainer).not.toBeNull();
    // Container lives inside a wrapper, which lives in the content area
    const wrapper = tabContainer?.parentElement;
    expect(wrapper?.classList.contains('mdview-tab-content-wrapper')).toBe(true);
    expect(wrapper?.parentElement).toBe(contentArea);
  });

  it('should hide inactive tab wrappers and show active', () => {
    const contentArea = document.getElementById('mdview-content-area')!;
    tabManager.setContentArea(contentArea);

    tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
    tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');

    const container1 = tabManager.getTabContainer('tab-1');
    const container2 = tabManager.getTabContainer('tab-2');

    // Visibility is controlled on the wrapper, not the content div
    expect(container1?.parentElement?.style.display).toBe('none');
    expect(container2?.parentElement?.style.display).toBe('');
  });

  it('should render tab-icon element in tab button', () => {
    tabManager.createTab('tab-1', '/tmp/test.md', 'test.md');
    const icon = container.querySelector('[data-tab-id="tab-1"] .tab-icon');
    expect(icon).not.toBeNull();
  });

  describe('dynamic sizing', () => {
    it('should apply icon-only class when many tabs open and bar is narrow', () => {
      // Create many tabs to force icon-only
      for (let i = 0; i < 15; i++) {
        tabManager.createTab(`tab-${i}`, `/tmp/${i}.md`, `${i}.md`);
      }

      // Simulate narrow tab bar via ResizeObserver
      const observer = MockResizeObserver.instances[0];
      observer.trigger([{ contentRect: { width: 400 } }]);

      const firstTab = container.querySelector('[data-tab-id="tab-0"]');
      expect(firstTab?.classList.contains('icon-only')).toBe(true);
    });

    it('should remove icon-only class when bar is wide enough', () => {
      for (let i = 0; i < 5; i++) {
        tabManager.createTab(`tab-${i}`, `/tmp/${i}.md`, `${i}.md`);
      }

      const observer = MockResizeObserver.instances[0];

      // First shrink to icon-only
      observer.trigger([{ contentRect: { width: 200 } }]);
      expect(
        container.querySelector('[data-tab-id="tab-0"]')?.classList.contains('icon-only')
      ).toBe(true);

      // Then expand
      observer.trigger([{ contentRect: { width: 2000 } }]);
      expect(
        container.querySelector('[data-tab-id="tab-0"]')?.classList.contains('icon-only')
      ).toBe(false);
    });

    it('should set inline max-width on tabs based on available space', () => {
      for (let i = 0; i < 5; i++) {
        tabManager.createTab(`tab-${i}`, `/tmp/${i}.md`, `${i}.md`);
      }

      const observer = MockResizeObserver.instances[0];
      // 500px / 5 tabs = 100px per tab (between min and ideal)
      observer.trigger([{ contentRect: { width: 500 } }]);

      const tab = container.querySelector('[data-tab-id="tab-0"]') as HTMLElement;
      expect(tab.style.maxWidth).toBe('100px');
    });
  });

  describe('tab groups', () => {
    it('should create a group and return its id', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
      tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');

      const groupId = tabManager.createGroup('Research', 'blue', ['tab-1', 'tab-2']);
      expect(groupId).toBeTruthy();
    });

    it('should render a group chip in the tab bar', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
      tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');

      tabManager.createGroup('Research', 'blue', ['tab-1', 'tab-2']);

      const chip = container.querySelector('.tab-group-chip');
      expect(chip).not.toBeNull();
      expect(chip?.textContent).toContain('Research');
      expect(chip?.classList.contains('tab-group-color-blue')).toBe(true);
    });

    it('should set data-group-color attribute on grouped tabs', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
      tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');

      tabManager.createGroup('Research', 'red', ['tab-1', 'tab-2']);

      const tab1 = container.querySelector('[data-tab-id="tab-1"]');
      expect(tab1?.getAttribute('data-group-color')).toBe('red');
    });

    it('should add tab to existing group', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
      tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');
      tabManager.createTab('tab-3', '/tmp/c.md', 'c.md');

      const groupId = tabManager.createGroup('Research', 'blue', ['tab-1']);
      tabManager.addTabToGroup('tab-2', groupId);

      const tab2 = container.querySelector('[data-tab-id="tab-2"]');
      expect(tab2?.getAttribute('data-group-color')).toBe('blue');
    });

    it('should remove tab from group', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
      tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');

      const groupId = tabManager.createGroup('Research', 'blue', ['tab-1', 'tab-2']);
      tabManager.removeTabFromGroup('tab-1');

      const tab1 = container.querySelector('[data-tab-id="tab-1"]');
      expect(tab1?.hasAttribute('data-group-color')).toBe(false);

      // Group should still exist with tab-2
      const group = tabManager.getGroup(groupId);
      expect(group?.tabIds).toEqual(['tab-2']);
    });

    it('should delete group when last tab is removed', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');

      const groupId = tabManager.createGroup('Research', 'blue', ['tab-1']);
      tabManager.removeTabFromGroup('tab-1');

      expect(tabManager.getGroup(groupId)).toBeUndefined();
      expect(container.querySelector('.tab-group-chip')).toBeNull();
    });

    it('should toggle group collapsed state', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
      tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');

      const groupId = tabManager.createGroup('Research', 'blue', ['tab-1', 'tab-2']);
      tabManager.toggleGroupCollapsed(groupId);

      // Collapsed group hides tab buttons
      const tab1 = container.querySelector('[data-tab-id="tab-1"]') as HTMLElement;
      expect(tab1.style.display).toBe('none');

      // Chip should have collapsed class
      const chip = container.querySelector('.tab-group-chip');
      expect(chip?.classList.contains('collapsed')).toBe(true);
    });

    it('should expand collapsed group on toggle', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');

      const groupId = tabManager.createGroup('Research', 'blue', ['tab-1']);
      tabManager.toggleGroupCollapsed(groupId);
      tabManager.toggleGroupCollapsed(groupId);

      const tab1 = container.querySelector('[data-tab-id="tab-1"]') as HTMLElement;
      expect(tab1.style.display).toBe('');
    });

    it('should update group name and color', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');

      const groupId = tabManager.createGroup('Research', 'blue', ['tab-1']);
      tabManager.updateGroup(groupId, { name: 'Docs', color: 'green' });

      const chip = container.querySelector('.tab-group-chip');
      expect(chip?.textContent).toContain('Docs');
      expect(chip?.classList.contains('tab-group-color-green')).toBe(true);

      const tab1 = container.querySelector('[data-tab-id="tab-1"]');
      expect(tab1?.getAttribute('data-group-color')).toBe('green');
    });

    it('should delete a group and ungroup all tabs', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
      tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');

      const groupId = tabManager.createGroup('Research', 'blue', ['tab-1', 'tab-2']);
      tabManager.deleteGroup(groupId);

      expect(container.querySelector('.tab-group-chip')).toBeNull();
      expect(container.querySelector('[data-tab-id="tab-1"]')?.hasAttribute('data-group-color')).toBe(false);
    });

    it('should fire onGroupChanged callback on group mutations', () => {
      const callback = vi.fn();
      tabManager.onGroupChanged(callback);

      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
      const groupId = tabManager.createGroup('Research', 'blue', ['tab-1']);

      expect(callback).toHaveBeenCalled();
      callback.mockClear();

      tabManager.updateGroup(groupId, { name: 'Docs' });
      expect(callback).toHaveBeenCalled();
    });

    it('should maintain insertion order: ungrouped tabs interleaved with groups', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
      tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');
      tabManager.createTab('tab-3', '/tmp/c.md', 'c.md');

      // Group tab-2 — chip should appear at tab-2's position (insertion order)
      tabManager.createGroup('Research', 'blue', ['tab-2']);

      const children = Array.from(container.children);
      // tab-1 (ungrouped), chip, tab-2, tab-3 (ungrouped)
      expect((children[0] as HTMLElement).dataset.tabId).toBe('tab-1');
      expect((children[1] as HTMLElement).classList.contains('tab-group-chip')).toBe(true);
      expect((children[2] as HTMLElement).dataset.tabId).toBe('tab-2');
      expect((children[3] as HTMLElement).dataset.tabId).toBe('tab-3');
    });

    it('should return all groups via getGroups()', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
      tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');

      tabManager.createGroup('A', 'blue', ['tab-1']);
      tabManager.createGroup('B', 'red', ['tab-2']);

      const groups = tabManager.getGroups();
      expect(groups).toHaveLength(2);
      expect(groups.map((g) => g.name).sort()).toEqual(['A', 'B']);
    });

    it('should render chip in dot-mode when name is empty', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
      tabManager.createGroup('', 'blue', ['tab-1']);

      const chip = container.querySelector('.tab-group-chip');
      expect(chip?.classList.contains('dot-mode')).toBe(true);

      const dot = chip?.querySelector('.tab-group-chip-dot');
      expect(dot).not.toBeNull();
    });

    it('should toggle dot-mode when name changes to/from empty', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
      const groupId = tabManager.createGroup('', 'blue', ['tab-1']);

      const chip = container.querySelector('.tab-group-chip');
      expect(chip?.classList.contains('dot-mode')).toBe(true);

      tabManager.updateGroup(groupId, { name: 'Research' });
      expect(chip?.classList.contains('dot-mode')).toBe(false);

      tabManager.updateGroup(groupId, { name: '' });
      expect(chip?.classList.contains('dot-mode')).toBe(true);
    });

    it('should not render indicator element in chip', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
      tabManager.createGroup('Research', 'blue', ['tab-1']);

      const indicator = container.querySelector('.tab-group-chip-indicator');
      expect(indicator).toBeNull();
    });

    it('should toggle collapse on chip left-click', () => {
      tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
      tabManager.createGroup('Research', 'blue', ['tab-1']);

      const chip = container.querySelector('.tab-group-chip') as HTMLElement;
      chip.click();

      expect(chip.classList.contains('collapsed')).toBe(true);
      const tab1 = container.querySelector('[data-tab-id="tab-1"]') as HTMLElement;
      expect(tab1.style.display).toBe('none');

      chip.click();
      expect(chip.classList.contains('collapsed')).toBe(false);
      expect(tab1.style.display).toBe('');
    });

    describe('editor bubble', () => {
      it('should show editor bubble on chip right-click', () => {
        tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
        tabManager.createGroup('Research', 'blue', ['tab-1']);

        const chip = container.querySelector('.tab-group-chip') as HTMLElement;
        chip.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        );

        const bubble = document.querySelector('.tab-group-editor-bubble');
        expect(bubble).not.toBeNull();
        expect(bubble?.querySelector('.tab-group-editor-name')).not.toBeNull();
        expect(bubble?.querySelectorAll('.tab-group-color-swatch').length).toBe(9);
        expect(bubble?.textContent).toContain('Ungroup');
        expect(bubble?.textContent).toContain('Close group');
      });

      it('should update group name when typing in editor name input', () => {
        tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
        tabManager.createGroup('Research', 'blue', ['tab-1']);

        const chip = container.querySelector('.tab-group-chip') as HTMLElement;
        chip.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        );

        const nameInput = document.querySelector('.tab-group-editor-name') as HTMLInputElement;
        nameInput.value = 'Docs';
        nameInput.dispatchEvent(new Event('input'));

        const label = chip.querySelector('.tab-group-chip-label');
        expect(label?.textContent).toBe('Docs');
      });

      it('should update group color when clicking a color swatch', () => {
        tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
        tabManager.createGroup('Research', 'blue', ['tab-1']);

        const chip = container.querySelector('.tab-group-chip') as HTMLElement;
        chip.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        );

        const redSwatch = document.querySelector('.tab-group-color-swatch[data-color="red"]') as HTMLElement;
        redSwatch.click();

        expect(chip.classList.contains('tab-group-color-red')).toBe(true);
      });

      it('should mark selected color swatch with .selected class', () => {
        tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
        tabManager.createGroup('Research', 'blue', ['tab-1']);

        const chip = container.querySelector('.tab-group-chip') as HTMLElement;
        chip.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        );

        const blueSwatch = document.querySelector('.tab-group-color-swatch[data-color="blue"]');
        expect(blueSwatch?.classList.contains('selected')).toBe(true);

        // Click red — blue deselected, red selected
        const redSwatch = document.querySelector('.tab-group-color-swatch[data-color="red"]') as HTMLElement;
        redSwatch.click();
        expect(redSwatch.classList.contains('selected')).toBe(true);
        expect(blueSwatch?.classList.contains('selected')).toBe(false);
      });

      it('should dismiss editor bubble on Escape', () => {
        tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
        tabManager.createGroup('Research', 'blue', ['tab-1']);

        const chip = container.querySelector('.tab-group-chip') as HTMLElement;
        chip.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        );

        expect(document.querySelector('.tab-group-editor-bubble')).not.toBeNull();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(document.querySelector('.tab-group-editor-bubble')).toBeNull();
      });

      it('should dismiss editor bubble on outside mousedown', () => {
        vi.useFakeTimers();
        tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
        tabManager.createGroup('Research', 'blue', ['tab-1']);

        const chip = container.querySelector('.tab-group-chip') as HTMLElement;
        chip.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        );

        expect(document.querySelector('.tab-group-editor-bubble')).not.toBeNull();
        vi.runAllTimers();
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        expect(document.querySelector('.tab-group-editor-bubble')).toBeNull();
        vi.useRealTimers();
      });

      it('should ungroup tabs when Ungroup button clicked', () => {
        tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
        tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');
        const groupId = tabManager.createGroup('Research', 'blue', ['tab-1', 'tab-2']);

        const chip = container.querySelector('.tab-group-chip') as HTMLElement;
        chip.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        );

        const ungroupBtn = Array.from(
          document.querySelectorAll('.tab-group-editor-action')
        ).find((el) => el.textContent === 'Ungroup') as HTMLElement;
        ungroupBtn.click();

        expect(tabManager.getGroup(groupId)).toBeUndefined();
        expect(container.querySelector('.tab-group-chip')).toBeNull();
        expect(document.querySelector('.tab-group-editor-bubble')).toBeNull();
      });

      it('should close all tabs in group when Close group button clicked', () => {
        const onClose = vi.fn();
        tabManager.onTabClose(onClose);

        tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
        tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');
        tabManager.createGroup('Research', 'blue', ['tab-1', 'tab-2']);

        const chip = container.querySelector('.tab-group-chip') as HTMLElement;
        chip.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        );

        const closeGroupBtn = Array.from(
          document.querySelectorAll('.tab-group-editor-action')
        ).find((el) => el.textContent === 'Close group') as HTMLElement;
        closeGroupBtn.click();

        expect(onClose).toHaveBeenCalledWith('tab-1');
        expect(onClose).toHaveBeenCalledWith('tab-2');
        expect(onClose).toHaveBeenCalledTimes(2);
        expect(document.querySelector('.tab-group-editor-bubble')).toBeNull();
      });
    });

    describe('context menu', () => {
      it('should show context menu on right-click', () => {
        tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');

        const tabBtn = container.querySelector('[data-tab-id="tab-1"]') as HTMLElement;
        tabBtn.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        );

        const menu = document.querySelector('.tab-context-menu');
        expect(menu).not.toBeNull();
      });

      it('should include "Add to new group" for ungrouped tab', () => {
        tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');

        const tabBtn = container.querySelector('[data-tab-id="tab-1"]') as HTMLElement;
        tabBtn.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        );

        const menu = document.querySelector('.tab-context-menu');
        expect(menu?.textContent).toContain('Add to new group');
      });

      it('should include "Remove from group" for grouped tab', () => {
        tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
        tabManager.createGroup('Research', 'blue', ['tab-1']);

        const tabBtn = container.querySelector('[data-tab-id="tab-1"]') as HTMLElement;
        tabBtn.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        );

        const menu = document.querySelector('.tab-context-menu');
        expect(menu?.textContent).toContain('Remove from group');
      });

      it('should always include "Close tab"', () => {
        tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');

        const tabBtn = container.querySelector('[data-tab-id="tab-1"]') as HTMLElement;
        tabBtn.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        );

        const menu = document.querySelector('.tab-context-menu');
        expect(menu?.textContent).toContain('Close tab');
      });

      it('should include export items in context menu', () => {
        tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');

        const tabBtn = container.querySelector('[data-tab-id="tab-1"]') as HTMLElement;
        tabBtn.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        );

        const menu = document.querySelector('.tab-context-menu');
        expect(menu?.textContent).toContain('Export as PDF');
        expect(menu?.textContent).toContain('Export as DOCX');
      });

      it('should fire onTabExport callback when export menu item clicked', () => {
        const exportCallback = vi.fn();
        tabManager.onTabExport(exportCallback);

        tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');

        const tabBtn = container.querySelector('[data-tab-id="tab-1"]') as HTMLElement;
        tabBtn.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        );

        const pdfItem = Array.from(
          document.querySelectorAll('.tab-context-menu-item')
        ).find((el) => el.textContent === 'Export as PDF') as HTMLElement;
        pdfItem.click();

        expect(exportCallback).toHaveBeenCalledWith('tab-1', 'pdf');
      });

      it('should dismiss context menu on outside click', () => {
        vi.useFakeTimers();
        tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');

        const tabBtn = container.querySelector('[data-tab-id="tab-1"]') as HTMLElement;
        tabBtn.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        );

        expect(document.querySelector('.tab-context-menu')).not.toBeNull();
        // Advance past the setTimeout(0) that defers the dismiss handler
        vi.runAllTimers();
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.querySelector('.tab-context-menu')).toBeNull();
        vi.useRealTimers();
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabManager } from './tab-manager';

describe('TabManager', () => {
  let tabManager: TabManager;
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="mdview-tab-bar"></div><div id="mdview-content-area"></div>';
    container = document.getElementById('mdview-tab-bar')!;
    tabManager = new TabManager();
    tabManager.render(container);
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
    expect(tabContainer?.parentElement).toBe(contentArea);
  });

  it('should hide inactive tab containers and show active', () => {
    const contentArea = document.getElementById('mdview-content-area')!;
    tabManager.setContentArea(contentArea);

    tabManager.createTab('tab-1', '/tmp/a.md', 'a.md');
    tabManager.createTab('tab-2', '/tmp/b.md', 'b.md');

    const container1 = tabManager.getTabContainer('tab-1');
    const container2 = tabManager.getTabContainer('tab-2');

    expect(container1?.style.display).toBe('none');
    expect(container2?.style.display).toBe('');
  });
});

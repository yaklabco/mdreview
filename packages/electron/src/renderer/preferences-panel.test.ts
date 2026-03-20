import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PreferencesPanel, type PreferencesPanelOptions, type ThemeOption } from './preferences-panel';

const defaultPrefs: PreferencesPanelOptions = {
  theme: 'github-light',
  autoReload: true,
  showToc: false,
  commentsEnabled: true,
  autoDarkMode: false,
};

const themes: ThemeOption[] = [
  { name: 'github-light', displayName: 'GitHub Light', variant: 'light' },
  { name: 'github-dark', displayName: 'GitHub Dark', variant: 'dark' },
  { name: 'catppuccin-latte', displayName: 'Catppuccin Latte', variant: 'light' },
  { name: 'catppuccin-mocha', displayName: 'Catppuccin Mocha', variant: 'dark' },
  { name: 'monokai', displayName: 'Monokai', variant: 'dark' },
];

describe('PreferencesPanel', () => {
  let panel: PreferencesPanel;

  beforeEach(() => {
    (globalThis.window as Record<string, unknown>).mdview = {
      updatePreferences: vi.fn().mockResolvedValue(undefined),
    };
    panel = new PreferencesPanel();
  });

  afterEach(() => {
    panel.dispose();
  });

  it('should show the modal overlay', () => {
    panel.show(defaultPrefs, themes);
    expect(document.querySelector('.preferences-overlay')).not.toBeNull();
    expect(document.querySelector('.preferences-panel')).not.toBeNull();
  });

  it('should display the title', () => {
    panel.show(defaultPrefs, themes);
    const title = document.querySelector('.preferences-panel h2');
    expect(title?.textContent).toBe('Preferences');
  });

  it('should render theme dropdown with grouped options', () => {
    panel.show(defaultPrefs, themes);
    const select = document.querySelector('select[data-pref="theme"]') as HTMLSelectElement;
    expect(select).not.toBeNull();

    const groups = select.querySelectorAll('optgroup');
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('Light');
    expect(groups[1].label).toBe('Dark');

    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(5);
    expect(select.value).toBe('github-light');
  });

  it('should call updatePreferences when theme changes', () => {
    panel.show(defaultPrefs, themes);
    const select = document.querySelector('select[data-pref="theme"]') as HTMLSelectElement;

    select.value = 'github-dark';
    select.dispatchEvent(new Event('change'));

    expect(window.mdview.updatePreferences).toHaveBeenCalledWith({ theme: 'github-dark' });
  });

  it('should render toggle checkboxes', () => {
    panel.show(defaultPrefs, themes);

    const autoReload = document.querySelector('input[data-pref="autoReload"]') as HTMLInputElement;
    expect(autoReload).not.toBeNull();
    expect(autoReload.checked).toBe(true);

    const showToc = document.querySelector('input[data-pref="showToc"]') as HTMLInputElement;
    expect(showToc).not.toBeNull();
    expect(showToc.checked).toBe(false);

    const comments = document.querySelector('input[data-pref="commentsEnabled"]') as HTMLInputElement;
    expect(comments.checked).toBe(true);

    const darkMode = document.querySelector('input[data-pref="autoDarkMode"]') as HTMLInputElement;
    expect(darkMode.checked).toBe(false);
  });

  it('should call updatePreferences when toggle changes', () => {
    panel.show(defaultPrefs, themes);

    const checkbox = document.querySelector('input[data-pref="showToc"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    expect(window.mdview.updatePreferences).toHaveBeenCalledWith({ showToc: true });
  });

  it('should close on Escape key', () => {
    panel.show(defaultPrefs, themes);
    expect(document.querySelector('.preferences-overlay')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.preferences-overlay')).toBeNull();
  });

  it('should close on backdrop click', () => {
    panel.show(defaultPrefs, themes);
    const overlay = document.querySelector('.preferences-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();

    // Click directly on the overlay (not the panel)
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.preferences-overlay')).toBeNull();
  });

  it('should close on close button click', () => {
    panel.show(defaultPrefs, themes);
    const closeBtn = document.querySelector('.preferences-close') as HTMLElement;
    expect(closeBtn).not.toBeNull();

    closeBtn.click();
    expect(document.querySelector('.preferences-overlay')).toBeNull();
  });

  it('should not create duplicate modals', () => {
    panel.show(defaultPrefs, themes);
    panel.show(defaultPrefs, themes);

    const overlays = document.querySelectorAll('.preferences-overlay');
    expect(overlays).toHaveLength(1);
  });

  it('should dispose cleanly', () => {
    panel.show(defaultPrefs, themes);
    panel.dispose();
    expect(document.querySelector('.preferences-overlay')).toBeNull();
  });

  it('should handle hide when not shown', () => {
    // Should not throw
    panel.hide();
    expect(document.querySelector('.preferences-overlay')).toBeNull();
  });
});

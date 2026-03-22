import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PreferencesPanel,
  type PreferencesPanelOptions,
  type ThemeOption,
} from './preferences-panel';

const defaultPrefs: PreferencesPanelOptions = {
  theme: 'github-light',
  autoTheme: false,
  lightTheme: 'github-light',
  darkTheme: 'github-dark',
  autoReload: true,
  showAllFiles: false,
  iconTheme: 'lucide',
  lineNumbers: false,
  enableHtml: true,
  fontFamily: undefined,
  codeFontFamily: undefined,
  lineHeight: undefined,
  useMaxWidth: undefined,
  maxWidth: undefined,
  showToc: false,
  tocPosition: 'left',
  tocMaxDepth: 6,
  tocAutoCollapse: false,
  exportDefaultFormat: undefined,
  exportDefaultPageSize: undefined,
  exportIncludeToc: undefined,
  exportFilenameTemplate: undefined,
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
    (globalThis.window as Record<string, unknown>).mdreview = {
      updatePreferences: vi.fn().mockResolvedValue(undefined),
    };
    panel = new PreferencesPanel();
  });

  afterEach(() => {
    panel.dispose();
  });

  // --- Structure tests ---

  describe('structure', () => {
    it('shows modal overlay with sidebar + content layout', () => {
      panel.show(defaultPrefs, themes);
      expect(document.querySelector('.preferences-overlay')).not.toBeNull();
      expect(document.querySelector('.preferences-panel')).not.toBeNull();
      expect(document.querySelector('.preferences-sidebar')).not.toBeNull();
      expect(document.querySelector('.preferences-content')).not.toBeNull();
    });

    it('sidebar has 4 category items', () => {
      panel.show(defaultPrefs, themes);
      const items = document.querySelectorAll('.preferences-sidebar-item');
      expect(items).toHaveLength(4);
      expect(items[0].textContent).toBe('General');
      expect(items[1].textContent).toBe('Display');
      expect(items[2].textContent).toBe('Table of Contents');
      expect(items[3].textContent).toBe('Export');
    });

    it('default category is General', () => {
      panel.show(defaultPrefs, themes);
      const active = document.querySelector('.preferences-sidebar-item.active');
      expect(active?.textContent).toBe('General');
    });

    it('switching category updates content area', () => {
      panel.show(defaultPrefs, themes);
      const items = document.querySelectorAll('.preferences-sidebar-item');

      // Click Display
      (items[1] as HTMLElement).click();
      expect(items[1].classList.contains('active')).toBe(true);
      expect(items[0].classList.contains('active')).toBe(false);

      // Should show line numbers toggle (Display category)
      expect(document.querySelector('[data-pref="lineNumbers"]')).not.toBeNull();
    });

    it('closes on Escape key', () => {
      panel.show(defaultPrefs, themes);
      expect(document.querySelector('.preferences-overlay')).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(document.querySelector('.preferences-overlay')).toBeNull();
    });

    it('closes on backdrop click', () => {
      panel.show(defaultPrefs, themes);
      const overlay = document.querySelector('.preferences-overlay') as HTMLElement;
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(document.querySelector('.preferences-overlay')).toBeNull();
    });

    it('closes on close button click', () => {
      panel.show(defaultPrefs, themes);
      const closeBtn = document.querySelector('.preferences-close') as HTMLElement;
      closeBtn.click();
      expect(document.querySelector('.preferences-overlay')).toBeNull();
    });

    it('does not create duplicate modals', () => {
      panel.show(defaultPrefs, themes);
      panel.show(defaultPrefs, themes);
      expect(document.querySelectorAll('.preferences-overlay')).toHaveLength(1);
    });
  });

  // --- General category tests ---

  describe('General category', () => {
    it('renders theme dropdown with light/dark optgroups', () => {
      panel.show(defaultPrefs, themes);
      const select = document.querySelector('[data-pref="theme"]') as HTMLSelectElement;
      expect(select).not.toBeNull();

      const groups = select.querySelectorAll('optgroup');
      expect(groups).toHaveLength(2);
      expect(groups[0].label).toBe('Light');
      expect(groups[1].label).toBe('Dark');
      expect(select.value).toBe('github-light');
    });

    it('theme change calls updatePreferences', () => {
      panel.show(defaultPrefs, themes);
      const select = document.querySelector('[data-pref="theme"]') as HTMLSelectElement;
      select.value = 'github-dark';
      select.dispatchEvent(new Event('change'));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(window.mdreview.updatePreferences).toHaveBeenCalledWith({ theme: 'github-dark' });
    });

    it('auto dark mode toggle shows conditional theme selectors', () => {
      panel.show(defaultPrefs, themes);

      // Conditional selectors should be hidden initially
      const conditional = document.querySelector('.preferences-conditional') as HTMLElement;
      expect(conditional).not.toBeNull();
      expect(conditional.classList.contains('expanded')).toBe(false);

      // Toggle auto dark mode on
      const toggle = document.querySelector('[data-pref="autoTheme"]') as HTMLInputElement;
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));

      expect(conditional.classList.contains('expanded')).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(window.mdreview.updatePreferences).toHaveBeenCalledWith({ autoTheme: true });
    });

    it('light/dark theme dropdowns visible when auto dark mode is on', () => {
      panel.show({ ...defaultPrefs, autoTheme: true }, themes);

      const conditional = document.querySelector('.preferences-conditional') as HTMLElement;
      expect(conditional.classList.contains('expanded')).toBe(true);

      const lightSelect = document.querySelector('[data-pref="lightTheme"]') as HTMLSelectElement;
      const darkSelect = document.querySelector('[data-pref="darkTheme"]') as HTMLSelectElement;
      expect(lightSelect).not.toBeNull();
      expect(darkSelect).not.toBeNull();
      expect(lightSelect.value).toBe('github-light');
      expect(darkSelect.value).toBe('github-dark');
    });

    it('auto reload toggle calls updatePreferences', () => {
      panel.show(defaultPrefs, themes);
      const toggle = document.querySelector('[data-pref="autoReload"]') as HTMLInputElement;
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(window.mdreview.updatePreferences).toHaveBeenCalledWith({ autoReload: false });
    });

    it('show all files toggle is present in General category', () => {
      panel.show(defaultPrefs, themes);
      const toggle = document.querySelector('[data-pref="showAllFiles"]') as HTMLInputElement;
      expect(toggle).not.toBeNull();
      expect(toggle.checked).toBe(false);
    });

    it('show all files toggle calls updatePreferences', () => {
      panel.show(defaultPrefs, themes);
      const toggle = document.querySelector('[data-pref="showAllFiles"]') as HTMLInputElement;
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(window.mdreview.updatePreferences).toHaveBeenCalledWith({ showAllFiles: true });
    });

    it('icon theme select renders in General category', () => {
      panel.show(defaultPrefs, themes);
      const select = document.querySelector('[data-pref="iconTheme"]') as HTMLSelectElement;
      expect(select).not.toBeNull();
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(7);
      expect(options[0].value).toBe('lucide');
      expect(options[1].value).toBe('codicons');
      expect(options[2].value).toBe('symbols');
      expect(options[3].value).toBe('one-dark');
      expect(options[4].value).toBe('material');
      expect(options[5].value).toBe('catppuccin');
      expect(options[6].value).toBe('seti');
      expect(select.value).toBe('lucide');
    });

    it('changing icon theme calls updatePreferences', () => {
      panel.show(defaultPrefs, themes);
      const select = document.querySelector('[data-pref="iconTheme"]') as HTMLSelectElement;
      select.value = 'codicons';
      select.dispatchEvent(new Event('change'));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(window.mdreview.updatePreferences).toHaveBeenCalledWith({ iconTheme: 'codicons' });
    });
  });

  // --- Display category tests ---

  describe('Display category', () => {
    function showDisplayCategory() {
      panel.show(defaultPrefs, themes);
      const items = document.querySelectorAll('.preferences-sidebar-item');
      (items[1] as HTMLElement).click();
    }

    it('line numbers toggle reflects initial value', () => {
      showDisplayCategory();
      const toggle = document.querySelector('[data-pref="lineNumbers"]') as HTMLInputElement;
      expect(toggle).not.toBeNull();
      expect(toggle.checked).toBe(false);
    });

    it('render HTML toggle present', () => {
      showDisplayCategory();
      const toggle = document.querySelector('[data-pref="enableHtml"]') as HTMLInputElement;
      expect(toggle).not.toBeNull();
      expect(toggle.checked).toBe(true);
    });

    it('font family input with placeholder', () => {
      showDisplayCategory();
      const input = document.querySelector('[data-pref="fontFamily"]') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.placeholder).toBe('System default');
    });

    it('max width toggle enables/disables number input', () => {
      showDisplayCategory();
      const toggle = document.querySelector('[data-pref="useMaxWidth"]') as HTMLInputElement;
      const numberInput = document.querySelector('[data-pref="maxWidth"]') as HTMLInputElement;
      expect(toggle).not.toBeNull();
      expect(numberInput).not.toBeNull();

      // Initially useMaxWidth is undefined/false, so number input should be disabled
      expect(numberInput.disabled).toBe(true);

      // Enable max width
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));
      expect(numberInput.disabled).toBe(false);
    });
  });

  // --- TOC category tests ---

  describe('TOC category', () => {
    function showTocCategory() {
      panel.show(defaultPrefs, themes);
      const items = document.querySelectorAll('.preferences-sidebar-item');
      (items[2] as HTMLElement).click();
    }

    it('show TOC toggle present', () => {
      showTocCategory();
      const toggle = document.querySelector('[data-pref="showToc"]') as HTMLInputElement;
      expect(toggle).not.toBeNull();
      expect(toggle.checked).toBe(false);
    });

    it('position dropdown with Left/Right options', () => {
      showTocCategory();
      const select = document.querySelector('[data-pref="tocPosition"]') as HTMLSelectElement;
      expect(select).not.toBeNull();
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(2);
      expect(options[0].value).toBe('left');
      expect(options[1].value).toBe('right');
    });

    it('max depth dropdown with correct options', () => {
      showTocCategory();
      const select = document.querySelector('[data-pref="tocMaxDepth"]') as HTMLSelectElement;
      expect(select).not.toBeNull();
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(5);
      expect(options[0].textContent).toBe('H2 only');
      expect(options[4].textContent).toBe('All levels');
    });
  });

  // --- Export category tests ---

  describe('Export category', () => {
    function showExportCategory() {
      panel.show(defaultPrefs, themes);
      const items = document.querySelectorAll('.preferences-sidebar-item');
      (items[3] as HTMLElement).click();
    }

    it('format dropdown with PDF/DOCX', () => {
      showExportCategory();
      const select = document.querySelector(
        '[data-pref="exportDefaultFormat"]'
      ) as HTMLSelectElement;
      expect(select).not.toBeNull();
      const options = select.querySelectorAll('option');
      expect(options.length).toBeGreaterThanOrEqual(2);
      const values = Array.from(options).map((o) => o.value);
      expect(values).toContain('pdf');
      expect(values).toContain('docx');
    });

    it('page size dropdown with optgroups', () => {
      showExportCategory();
      const select = document.querySelector(
        '[data-pref="exportDefaultPageSize"]'
      ) as HTMLSelectElement;
      expect(select).not.toBeNull();
      const groups = select.querySelectorAll('optgroup');
      expect(groups).toHaveLength(2);
      expect(groups[0].label).toBe('ISO');
      expect(groups[1].label).toBe('North American');
    });

    it('filename template input with live preview', () => {
      showExportCategory();
      const input = document.querySelector(
        '[data-pref="exportFilenameTemplate"]'
      ) as HTMLInputElement;
      expect(input).not.toBeNull();

      const preview = document.querySelector('.preferences-filename-preview');
      expect(preview).not.toBeNull();

      // Type a template and check preview updates
      input.value = '{title}-{date}';
      input.dispatchEvent(new Event('input'));
      expect(preview?.textContent).toContain('document-');
    });
  });

  // --- Lifecycle tests ---

  describe('lifecycle', () => {
    it('disposes cleanly', () => {
      panel.show(defaultPrefs, themes);
      panel.dispose();
      expect(document.querySelector('.preferences-overlay')).toBeNull();
    });

    it('handles hide when not shown', () => {
      panel.hide();
      expect(document.querySelector('.preferences-overlay')).toBeNull();
    });
  });
});

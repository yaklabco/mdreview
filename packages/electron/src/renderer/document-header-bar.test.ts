import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DocumentHeaderBar } from './document-header-bar';

describe('DocumentHeaderBar', () => {
  let headerBar: DocumentHeaderBar;
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="mdreview-header-bar"></div>';
    container = document.getElementById('mdreview-header-bar')!;
    headerBar = new DocumentHeaderBar();
    headerBar.render(container);
  });

  afterEach(() => {
    headerBar.dispose();
  });

  describe('breadcrumb', () => {
    it('should render file name as single segment when no folder is open', () => {
      headerBar.update('/Users/me/docs/README.md', null);
      const segments = container.querySelectorAll('.header-bar-breadcrumb-segment');
      expect(segments).toHaveLength(1);
      expect(segments[0].textContent).toBe('README.md');
    });

    it('should render relative breadcrumb when folder is open', () => {
      headerBar.update('/Users/me/docs/api/guide/README.md', '/Users/me/docs');
      const segments = container.querySelectorAll('.header-bar-breadcrumb-segment');
      expect(segments).toHaveLength(3);
      expect(segments[0].textContent).toBe('api');
      expect(segments[1].textContent).toBe('guide');
      expect(segments[2].textContent).toBe('README.md');
    });

    it('should render separators between segments', () => {
      headerBar.update('/Users/me/docs/api/README.md', '/Users/me/docs');
      const separators = container.querySelectorAll('.header-bar-breadcrumb-separator');
      expect(separators).toHaveLength(1); // one separator between 2 segments
    });

    it('should handle file at root of open folder', () => {
      headerBar.update('/Users/me/docs/README.md', '/Users/me/docs');
      const segments = container.querySelectorAll('.header-bar-breadcrumb-segment');
      expect(segments).toHaveLength(1);
      expect(segments[0].textContent).toBe('README.md');
    });

    it('should clear breadcrumb when filePath is null', () => {
      headerBar.update('/Users/me/docs/README.md', null);
      headerBar.update(null, null);
      const segments = container.querySelectorAll('.header-bar-breadcrumb-segment');
      expect(segments).toHaveLength(0);
    });
  });

  describe('export action', () => {
    it('should render export button with label text', () => {
      headerBar.update('/tmp/test.md', null);
      const btn = container.querySelector('.header-bar-export-btn');
      expect(btn).not.toBeNull();
      expect(btn?.textContent).toContain('Export');
    });

    it('should show dropdown on export button click', () => {
      headerBar.update('/tmp/test.md', null);
      const btn = container.querySelector('.header-bar-export-btn') as HTMLElement;
      btn.click();
      const dropdown = document.querySelector('.header-bar-dropdown');
      expect(dropdown).not.toBeNull();
      expect(dropdown?.textContent).toContain('Export as PDF');
      expect(dropdown?.textContent).toContain('Export as DOCX');
    });

    it('should append dropdown to document.body with fixed positioning', () => {
      headerBar.update('/tmp/test.md', null);
      const btn = container.querySelector('.header-bar-export-btn') as HTMLElement;
      btn.click();
      const dropdown = document.querySelector('.header-bar-dropdown');
      expect(dropdown?.parentElement).toBe(document.body);
    });

    it('should fire onExport callback with format', () => {
      const callback = vi.fn();
      headerBar.onExport(callback);
      headerBar.update('/tmp/test.md', null);

      const btn = container.querySelector('.header-bar-export-btn') as HTMLElement;
      btn.click();

      const pdfItem = document.querySelector('.header-bar-dropdown-item') as HTMLElement;
      pdfItem.click();

      expect(callback).toHaveBeenCalledWith('pdf');
    });

    it('should dismiss dropdown on outside click', () => {
      vi.useFakeTimers();
      headerBar.update('/tmp/test.md', null);

      const btn = container.querySelector('.header-bar-export-btn') as HTMLElement;
      btn.click();

      expect(document.querySelector('.header-bar-dropdown')).not.toBeNull();

      vi.runAllTimers();
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(document.querySelector('.header-bar-dropdown')).toBeNull();
      vi.useRealTimers();
    });

    it('should not show export button when no file is active', () => {
      headerBar.update(null, null);
      const btn = container.querySelector('.header-bar-export-btn');
      expect(btn).toBeNull();
    });
  });

  describe('visibility', () => {
    it('should show by default', () => {
      expect(container.classList.contains('hidden')).toBe(false);
    });

    it('should hide when setVisible(false)', () => {
      headerBar.setVisible(false);
      expect(container.classList.contains('hidden')).toBe(true);
    });

    it('should show when setVisible(true)', () => {
      headerBar.setVisible(false);
      headerBar.setVisible(true);
      expect(container.classList.contains('hidden')).toBe(false);
    });
  });

  describe('breadcrumb click', () => {
    it('should fire onBreadcrumbClick with folder path when segment clicked', () => {
      const callback = vi.fn();
      headerBar.onBreadcrumbClick(callback);

      headerBar.update('/Users/me/docs/api/guide/README.md', '/Users/me/docs');

      const segments = container.querySelectorAll('.header-bar-breadcrumb-segment');
      // Click the 'api' segment
      (segments[0] as HTMLElement).click();

      expect(callback).toHaveBeenCalledWith('/Users/me/docs/api');
    });

    it('should not fire callback when clicking the file segment', () => {
      const callback = vi.fn();
      headerBar.onBreadcrumbClick(callback);

      headerBar.update('/Users/me/docs/api/README.md', '/Users/me/docs');

      const segments = container.querySelectorAll('.header-bar-breadcrumb-segment');
      // Click the file segment (last)
      (segments[segments.length - 1] as HTMLElement).click();

      expect(callback).not.toHaveBeenCalled();
    });
  });
});

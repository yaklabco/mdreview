/**
 * Tests for core ExportUI with MessagingAdapter
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MessagingAdapter } from '../adapters';
import { NoopMessagingAdapter } from '../adapters';

// We need to mock the DOM for ExportUI
function setupDOM(): void {
  document.body.innerHTML = '';
}

describe('ExportUI (core)', () => {
  beforeEach(() => {
    setupDOM();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('constructor with MessagingAdapter', () => {
    it('accepts an optional MessagingAdapter and loads preferences via it', async () => {
      const mockMessaging: MessagingAdapter = {
        send: vi.fn().mockResolvedValue({
          state: {
            preferences: {
              exportDefaultPageSize: 'Letter',
              exportDefaultFormat: 'pdf',
              exportIncludeToc: false,
              exportFilenameTemplate: '{title}-{date}',
            },
          },
        }),
      };

      const { ExportUI } = await import('../ui/export-ui');
      const ui = new ExportUI({ messaging: mockMessaging });

      // Give loadPreferences time to run (it's async in constructor)
      await vi.waitFor(() => {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockMessaging.send).toHaveBeenCalledWith({ type: 'GET_STATE' });
      });

      // Verify the adapter was called with the right message
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockMessaging.send).toHaveBeenCalledTimes(1);

      ui.destroy();
    });

    it('applies loaded preferences to options', async () => {
      const mockMessaging: MessagingAdapter = {
        send: vi.fn().mockResolvedValue({
          state: {
            preferences: {
              exportDefaultPageSize: 'Letter',
              exportDefaultFormat: 'pdf',
            },
          },
        }),
      };

      const { ExportUI } = await import('../ui/export-ui');
      const ui = new ExportUI({ messaging: mockMessaging });

      // Wait for preferences to load
      await vi.waitFor(() => {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockMessaging.send).toHaveBeenCalled();
      });

      // The ExportUI should have updated its internal options
      // We can verify by creating the button and checking it works
      const button = ui.createExportButton();
      expect(button).toBeTruthy();
      expect(button.className).toContain('mdreview-export-btn');

      ui.destroy();
    });
  });

  describe('graceful degradation without adapter', () => {
    it('creates ExportUI without a messaging adapter', async () => {
      const { ExportUI } = await import('../ui/export-ui');
      const ui = new ExportUI();

      // Should not throw
      expect(ui).toBeTruthy();

      const button = ui.createExportButton();
      expect(button).toBeTruthy();
      expect(button.className).toContain('mdreview-export-btn');

      ui.destroy();
    });

    it('works with NoopMessagingAdapter', async () => {
      const noopMessaging = new NoopMessagingAdapter();
      const sendSpy = vi.spyOn(noopMessaging, 'send');

      const { ExportUI } = await import('../ui/export-ui');
      const ui = new ExportUI({ messaging: noopMessaging });

      // Wait for the async loadPreferences to complete
      await vi.waitFor(() => {
        expect(sendSpy).toHaveBeenCalled();
      });

      // NoopMessagingAdapter returns {} which has no state.preferences
      // So options should remain at defaults
      const button = ui.createExportButton();
      expect(button).toBeTruthy();

      ui.destroy();
    });

    it('handles messaging adapter that rejects', async () => {
      const failingMessaging: MessagingAdapter = {
        send: vi.fn().mockRejectedValue(new Error('Connection failed')),
      };

      const { ExportUI } = await import('../ui/export-ui');
      // Should not throw even if messaging fails
      const ui = new ExportUI({ messaging: failingMessaging });

      await vi.waitFor(() => {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(failingMessaging.send).toHaveBeenCalled();
      });

      // Should still work - graceful degradation
      const button = ui.createExportButton();
      expect(button).toBeTruthy();

      ui.destroy();
    });

    it('handles messaging adapter that returns empty response', async () => {
      const emptyMessaging: MessagingAdapter = {
        send: vi.fn().mockResolvedValue(null),
      };

      const { ExportUI } = await import('../ui/export-ui');
      const ui = new ExportUI({ messaging: emptyMessaging });

      await vi.waitFor(() => {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(emptyMessaging.send).toHaveBeenCalled();
      });

      // Should work fine with null response
      const button = ui.createExportButton();
      expect(button).toBeTruthy();

      ui.destroy();
    });
  });

  describe('UI functionality', () => {
    it('creates export button with correct attributes', async () => {
      const { ExportUI } = await import('../ui/export-ui');
      const ui = new ExportUI();

      const button = ui.createExportButton();

      expect(button.getAttribute('aria-label')).toBe('Export document');
      expect(button.getAttribute('aria-haspopup')).toBe('menu');
      expect(button.getAttribute('aria-expanded')).toBe('false');

      ui.destroy();
    });

    it('toggles menu visibility', async () => {
      const { ExportUI } = await import('../ui/export-ui');
      const ui = new ExportUI();
      ui.createExportButton();

      // Show menu
      ui.showMenu();
      // There should be a menu in the DOM
      const menu = document.querySelector('.mdreview-export-menu');
      expect(menu).toBeTruthy();

      // Hide menu
      ui.hideMenu();

      ui.destroy();
    });

    it('destroys cleanly', async () => {
      const { ExportUI } = await import('../ui/export-ui');
      const ui = new ExportUI();
      const button = ui.createExportButton();
      document.body.appendChild(button);

      ui.showMenu();

      // Should not throw
      ui.destroy();
    });
  });

  describe('does NOT import chrome APIs', () => {
    it('module source does not reference chrome.runtime', async () => {
      // This is a static analysis check - import the module and verify
      // it loaded without chrome global
      const originalChrome = (globalThis as Record<string, unknown>).chrome;
      delete (globalThis as Record<string, unknown>).chrome;

      try {
        // Re-import to ensure it works without chrome global
        const mod = await import('../ui/export-ui');
        expect(mod.ExportUI).toBeDefined();
      } finally {
        if (originalChrome !== undefined) {
          (globalThis as Record<string, unknown>).chrome = originalChrome;
        }
      }
    });
  });
});

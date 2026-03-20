/**
 * Theme Engine — Chrome extension shim
 *
 * Wraps the platform-agnostic ThemeEngine from @mdview/core,
 * wired up with a Chrome StorageAdapter and DOM-specific methods
 * (applyTheme, watchSystemTheme, updateSyntaxTheme).
 */

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

import type { Theme, ThemeName, StorageAdapter, ThemeOverrides } from '@mdview/core';
import { ThemeEngine as CoreThemeEngine } from '@mdview/core';
import { debug } from '../utils/debug-logger';

export type { ThemeInfo } from '@mdview/core';

// ---------------------------------------------------------------------------
// Chrome StorageAdapter
// ---------------------------------------------------------------------------

const chromeStorageAdapter: StorageAdapter = {
  async getSync(keys: string | string[]): Promise<Record<string, unknown>> {
    return chrome.storage.sync.get(keys) as Promise<Record<string, unknown>>;
  },
  async setSync(data: Record<string, unknown>): Promise<void> {
    await chrome.storage.sync.set(data);
  },
  async getLocal(keys: string | string[]): Promise<Record<string, unknown>> {
    return chrome.storage.local.get(keys) as Promise<Record<string, unknown>>;
  },
  async setLocal(data: Record<string, unknown>): Promise<void> {
    await chrome.storage.local.set(data);
  },
};

// ---------------------------------------------------------------------------
// Chrome ThemeEngine — composition over the core engine
// ---------------------------------------------------------------------------

export class ThemeEngine {
  private core: InstanceType<typeof CoreThemeEngine>;

  constructor() {
    this.core = new CoreThemeEngine(chromeStorageAdapter);
  }

  /**
   * Load theme by name (delegated to core)
   */
  async loadTheme(themeName: ThemeName): Promise<Theme> {
    return this.core.loadTheme(themeName);
  }

  /**
   * Get currently applied theme
   */
  getCurrentTheme(): Theme | null {
    return this.core.getCurrentTheme();
  }

  /**
   * Get list of available themes
   */
  getAvailableThemes(): Array<{
    name: ThemeName;
    displayName: string;
    variant: 'light' | 'dark';
    preview?: string;
  }> {
    return this.core.getAvailableThemes();
  }

  /**
   * Compile theme to CSS variables (delegated to core)
   */
  compileToCSSVariables(
    theme: Theme,
    overrides: Partial<Theme['typography']> = {}
  ): Record<string, string> {
    return this.core.compileToCSSVariables(theme, overrides);
  }

  /**
   * Apply theme to document (DOM-specific)
   */
  async applyTheme(theme: Theme | ThemeName): Promise<void> {
    debug.log(
      'ThemeEngine',
      `applyTheme called with:`,
      typeof theme === 'string' ? theme : theme.name
    );

    // Load theme if name provided
    const themeObj: Theme = typeof theme === 'string' ? await this.loadTheme(theme) : theme;
    debug.log('ThemeEngine', `Theme loaded/resolved:`, themeObj.name);

    // Fetch overrides from storage via the core adapter path
    const overrides: ThemeOverrides = await this.core.getStorageOverrides();

    // Compile to CSS variables with overrides
    const cssVars = this.compileToCSSVariables(themeObj, overrides);

    // Apply transition class
    const root = document.documentElement;
    root.classList.add('theme-transitioning');

    // Update CSS variables on both :root and documentElement for immediate effect
    debug.log(
      'ThemeEngine',
      `Applying ${Object.keys(cssVars).length} CSS variables to :root and html`
    );
    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
      // Force immediate style recalculation for critical color variables
      if (key === '--md-bg' || key === '--md-fg') {
        document.documentElement.style.setProperty(key, value);
        document.body.style.setProperty(key, value);
      }
    });

    // Apply max-width logic
    if (overrides.useMaxWidth) {
      // If "Use Full Width" is checked, set max-width to none or 100%
      root.style.setProperty('--md-max-width', '100%');
    } else if (overrides.maxWidth) {
      // Apply custom max-width if set
      root.style.setProperty('--md-max-width', `${overrides.maxWidth}px`);
    } else {
      // Default
      root.style.setProperty('--md-max-width', '980px');
    }

    // Set data attributes
    root.setAttribute('data-theme', themeObj.name);
    root.setAttribute('data-theme-variant', themeObj.variant);

    // Apply background color directly to body and html to prevent white flash
    document.documentElement.style.backgroundColor = themeObj.colors.background;
    document.body.style.backgroundColor = themeObj.colors.background;
    document.documentElement.style.color = themeObj.colors.foreground;
    document.body.style.color = themeObj.colors.foreground;

    // Update syntax theme
    debug.log('ThemeEngine', `Updating syntax theme to: ${themeObj.syntaxTheme}`);
    await this.updateSyntaxTheme(themeObj.syntaxTheme);

    // Update mermaid theme
    try {
      const { mermaidRenderer } = await import('@mdview/core');
      mermaidRenderer.updateTheme(themeObj.mermaidTheme);
    } catch (error) {
      debug.error('ThemeEngine', 'Failed to update mermaid theme:', error);
    }

    // Remove transition class after a brief moment (non-blocking)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('theme-transitioning');
      });
    });

    // Save current theme
    this.core.setCurrentTheme(themeObj);

    debug.log('ThemeEngine', `Successfully applied theme: ${themeObj.name}`);
  }

  /**
   * Watch system theme preference
   */
  watchSystemTheme(callback: (isDark: boolean) => void): () => void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      callback(e.matches);
    };

    // Initial call
    handler(mediaQuery);

    // Listen for changes
    mediaQuery.addEventListener('change', handler);

    // Return cleanup function
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }

  /**
   * Update syntax highlighting theme
   */
  private async updateSyntaxTheme(syntaxTheme: string): Promise<void> {
    try {
      const { syntaxHighlighter } = await import('@mdview/core');
      syntaxHighlighter.setTheme(syntaxTheme);
    } catch (error) {
      debug.error('ThemeEngine', 'Failed to update syntax theme:', error);
    }
  }
}

// Export singleton
export const themeEngine = new ThemeEngine();

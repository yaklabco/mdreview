/**
 * Theme Engine (platform-agnostic)
 * Manages theme loading, switching, and customization.
 *
 * Accepts an optional StorageAdapter for preference overrides.
 * Works without an adapter (graceful degradation — theme defaults only).
 */

import type { Theme, ThemeName, AppState } from './types/index';
import type { StorageAdapter } from './adapters';

export interface ThemeInfo {
  name: ThemeName;
  displayName: string;
  variant: 'light' | 'dark';
  preview?: string;
}

export interface ThemeOverrides extends Partial<Theme['typography']> {
  maxWidth?: number;
  useMaxWidth?: boolean;
}

// Static theme registry — avoids dynamic imports that need bundler support.
// Lazily loaded to avoid circular dependency issues.
let themeRegistry: Map<ThemeName, () => Promise<Theme>> | null = null;

function getThemeRegistry(): Map<ThemeName, () => Promise<Theme>> {
  if (!themeRegistry) {
    themeRegistry = new Map<ThemeName, () => Promise<Theme>>([
      ['github-light', () => import('./themes/github-light').then((m) => m.default)],
      ['github-dark', () => import('./themes/github-dark').then((m) => m.default)],
      ['catppuccin-latte', () => import('./themes/catppuccin-latte').then((m) => m.default)],
      ['catppuccin-frappe', () => import('./themes/catppuccin-frappe').then((m) => m.default)],
      [
        'catppuccin-macchiato',
        () => import('./themes/catppuccin-macchiato').then((m) => m.default),
      ],
      ['catppuccin-mocha', () => import('./themes/catppuccin-mocha').then((m) => m.default)],
      ['monokai', () => import('./themes/monokai').then((m) => m.default)],
      ['monokai-pro', () => import('./themes/monokai-pro').then((m) => m.default)],
    ]);
  }
  return themeRegistry;
}

export class ThemeEngine {
  private currentTheme: Theme | null = null;
  private cache: Map<ThemeName, Theme> = new Map();
  private storage: StorageAdapter | undefined;

  constructor(storage?: StorageAdapter) {
    this.storage = storage;
  }

  /**
   * Load theme by name
   */
  async loadTheme(themeName: ThemeName): Promise<Theme> {
    // Check cache
    const cached = this.cache.get(themeName);
    if (cached) {
      return cached;
    }

    try {
      const registry = getThemeRegistry();
      const loader = registry.get(themeName);
      if (!loader) {
        throw new Error(`Unknown theme: ${themeName}`);
      }
      const theme = await loader();

      // Cache theme
      this.cache.set(themeName, theme);
      return theme;
    } catch (error) {
      // Fallback to github-light
      if (themeName !== 'github-light') {
        return this.loadTheme('github-light');
      }
      throw error;
    }
  }

  /**
   * Fetch preference overrides from storage adapter.
   * Returns an empty object when no adapter is configured.
   */
  async getStorageOverrides(): Promise<ThemeOverrides> {
    if (!this.storage) {
      return {};
    }

    const overrides: ThemeOverrides = {};
    try {
      const storage = (await this.storage.getSync('preferences')) as {
        preferences?: Partial<AppState['preferences']>;
      };
      if (storage.preferences) {
        const p = storage.preferences;
        if (p.fontFamily) overrides.fontFamily = p.fontFamily;
        if (p.codeFontFamily) overrides.codeFontFamily = p.codeFontFamily;
        if (p.lineHeight) overrides.baseLineHeight = p.lineHeight;
        if (p.maxWidth) overrides.maxWidth = p.maxWidth;
        overrides.useMaxWidth = p.useMaxWidth;
      }
    } catch {
      // Graceful degradation — return empty overrides
    }

    return overrides;
  }

  /**
   * Get currently applied theme
   */
  getCurrentTheme(): Theme | null {
    return this.currentTheme;
  }

  /**
   * Set the current theme (used after applying a theme in the host environment)
   */
  setCurrentTheme(theme: Theme): void {
    this.currentTheme = theme;
  }

  /**
   * Get list of available themes
   */
  getAvailableThemes(): ThemeInfo[] {
    return [
      { name: 'github-light', displayName: 'GitHub Light', variant: 'light' },
      { name: 'github-dark', displayName: 'GitHub Dark', variant: 'dark' },
      { name: 'catppuccin-latte', displayName: 'Catppuccin Latte', variant: 'light' },
      { name: 'catppuccin-frappe', displayName: 'Catppuccin Frappé', variant: 'light' },
      { name: 'catppuccin-macchiato', displayName: 'Catppuccin Macchiato', variant: 'dark' },
      { name: 'catppuccin-mocha', displayName: 'Catppuccin Mocha', variant: 'dark' },
      { name: 'monokai', displayName: 'Monokai', variant: 'dark' },
      { name: 'monokai-pro', displayName: 'Monokai Pro', variant: 'dark' },
    ];
  }

  /**
   * Compile theme to CSS variables
   */
  compileToCSSVariables(
    theme: Theme,
    overrides: Partial<Theme['typography']> = {}
  ): Record<string, string> {
    return {
      // Colors
      '--md-bg': theme.colors.background,
      '--md-bg-secondary': theme.colors.backgroundSecondary,
      '--md-bg-tertiary': theme.colors.backgroundTertiary,
      '--md-fg': theme.colors.foreground,
      '--md-fg-secondary': theme.colors.foregroundSecondary,
      '--md-fg-muted': theme.colors.foregroundMuted,
      '--md-primary': theme.colors.primary,
      '--md-secondary': theme.colors.secondary,
      '--md-accent': theme.colors.accent,
      '--md-heading': theme.colors.heading,
      '--md-link': theme.colors.link,
      '--md-link-hover': theme.colors.linkHover,
      '--md-link-visited': theme.colors.linkVisited,
      '--md-code-bg': theme.colors.codeBackground,
      '--md-code-text': theme.colors.codeText,
      '--md-code-keyword': theme.colors.codeKeyword,
      '--md-code-string': theme.colors.codeString,
      '--md-code-comment': theme.colors.codeComment,
      '--md-code-function': theme.colors.codeFunction,
      '--md-border': theme.colors.border,
      '--md-border-light': theme.colors.borderLight,
      '--md-border-heavy': theme.colors.borderHeavy,
      '--md-selection': theme.colors.selection,
      '--md-highlight': theme.colors.highlight,
      '--md-shadow': theme.colors.shadow,
      '--md-success': theme.colors.success,
      '--md-warning': theme.colors.warning,
      '--md-error': theme.colors.error,
      '--md-info': theme.colors.info,
      '--md-comment-highlight': theme.colors.commentHighlight,
      '--md-comment-highlight-resolved': theme.colors.commentHighlightResolved,
      '--md-comment-card-bg': theme.colors.commentCardBg,

      // Typography (with overrides)
      '--md-font-family': overrides.fontFamily || theme.typography.fontFamily,
      '--md-font-family-heading':
        theme.typography.headingFontFamily || overrides.fontFamily || theme.typography.fontFamily,
      '--md-font-family-code': overrides.codeFontFamily || theme.typography.codeFontFamily,
      '--md-font-size': theme.typography.baseFontSize,
      '--md-line-height': (overrides.baseLineHeight || theme.typography.baseLineHeight).toString(),
      '--md-h1-size': theme.typography.h1Size,
      '--md-h2-size': theme.typography.h2Size,
      '--md-h3-size': theme.typography.h3Size,
      '--md-h4-size': theme.typography.h4Size,
      '--md-h5-size': theme.typography.h5Size,
      '--md-h6-size': theme.typography.h6Size,
      '--md-font-weight': theme.typography.fontWeightNormal.toString(),
      '--md-font-weight-bold': theme.typography.fontWeightBold.toString(),
      '--md-heading-font-weight': theme.typography.headingFontWeight.toString(),

      // Spacing
      '--md-block-margin': theme.spacing.blockMargin,
      '--md-paragraph-margin': theme.spacing.paragraphMargin,
      '--md-list-item-margin': theme.spacing.listItemMargin,
      '--md-heading-margin': theme.spacing.headingMargin,
      '--md-code-block-padding': theme.spacing.codeBlockPadding,
      '--md-table-cell-padding': theme.spacing.tableCellPadding,
    };
  }
}

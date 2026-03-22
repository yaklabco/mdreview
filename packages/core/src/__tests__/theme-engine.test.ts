import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Theme } from '../types/index';
import type { StorageAdapter } from '../adapters';
import { NoopStorageAdapter } from '../adapters';
import githubLight from '../themes/github-light';
import githubDark from '../themes/github-dark';

// Import the class under test
import { ThemeEngine } from '../theme-engine';

describe('ThemeEngine', () => {
  let engine: ThemeEngine;

  beforeEach(() => {
    engine = new ThemeEngine();
  });

  describe('loadTheme', () => {
    it('loads a theme by name', async () => {
      const theme = await engine.loadTheme('github-light');
      expect(theme.name).toBe('github-light');
      expect(theme.variant).toBe('light');
    });

    it('caches loaded themes', async () => {
      const first = await engine.loadTheme('github-dark');
      const second = await engine.loadTheme('github-dark');
      expect(first).toBe(second); // same reference
    });

    it('falls back to github-light for unknown themes', async () => {
      // 'test-theme' is listed in ThemeName type but has no module
      const theme = await engine.loadTheme('test-theme');
      expect(theme.name).toBe('github-light');
    });
  });

  describe('compileToCSSVariables', () => {
    it('compiles theme colors to CSS variables', () => {
      const vars = engine.compileToCSSVariables(githubLight);
      expect(vars['--md-bg']).toBe(githubLight.colors.background);
      expect(vars['--md-fg']).toBe(githubLight.colors.foreground);
      expect(vars['--md-primary']).toBe(githubLight.colors.primary);
    });

    it('compiles typography to CSS variables', () => {
      const vars = engine.compileToCSSVariables(githubLight);
      expect(vars['--md-font-family']).toBe(githubLight.typography.fontFamily);
      expect(vars['--md-font-family-code']).toBe(githubLight.typography.codeFontFamily);
      expect(vars['--md-line-height']).toBe(githubLight.typography.baseLineHeight.toString());
    });

    it('compiles spacing to CSS variables', () => {
      const vars = engine.compileToCSSVariables(githubLight);
      expect(vars['--md-block-margin']).toBe(githubLight.spacing.blockMargin);
      expect(vars['--md-paragraph-margin']).toBe(githubLight.spacing.paragraphMargin);
    });

    it('applies typography overrides', () => {
      const vars = engine.compileToCSSVariables(githubLight, {
        fontFamily: 'Custom Sans',
        codeFontFamily: 'Custom Mono',
        baseLineHeight: 2.0,
      });
      expect(vars['--md-font-family']).toBe('Custom Sans');
      expect(vars['--md-font-family-code']).toBe('Custom Mono');
      expect(vars['--md-line-height']).toBe('2');
    });
  });

  describe('with StorageAdapter', () => {
    it('applies theme correctly with mock StorageAdapter providing overrides', async () => {
      const storage = new NoopStorageAdapter();
      await storage.setSync({
        preferences: {
          fontFamily: 'Inter',
          codeFontFamily: 'Fira Code',
          lineHeight: 1.8,
          maxWidth: 1200,
        },
      });

      const engineWithStorage = new ThemeEngine(storage);
      const overrides = await engineWithStorage.getStorageOverrides();

      expect(overrides.fontFamily).toBe('Inter');
      expect(overrides.codeFontFamily).toBe('Fira Code');
      expect(overrides.baseLineHeight).toBe(1.8);
      expect(overrides.maxWidth).toBe(1200);
    });

    it('applies useMaxWidth override from storage', async () => {
      const storage = new NoopStorageAdapter();
      await storage.setSync({
        preferences: {
          useMaxWidth: true,
        },
      });

      const engineWithStorage = new ThemeEngine(storage);
      const overrides = await engineWithStorage.getStorageOverrides();

      expect(overrides.useMaxWidth).toBe(true);
    });
  });

  describe('without StorageAdapter (graceful degradation)', () => {
    it('works without adapter — uses theme defaults only', () => {
      const engineNoAdapter = new ThemeEngine();
      const vars = engineNoAdapter.compileToCSSVariables(githubLight);

      // Should use theme defaults, not any overrides
      expect(vars['--md-font-family']).toBe(githubLight.typography.fontFamily);
      expect(vars['--md-font-family-code']).toBe(githubLight.typography.codeFontFamily);
      expect(vars['--md-line-height']).toBe(githubLight.typography.baseLineHeight.toString());
    });

    it('getStorageOverrides returns empty object without adapter', async () => {
      const engineNoAdapter = new ThemeEngine();
      const overrides = await engineNoAdapter.getStorageOverrides();

      expect(overrides).toEqual({});
    });
  });

  describe('font overrides from storage are applied', () => {
    it('produces CSS variables with storage font overrides', async () => {
      const storage = new NoopStorageAdapter();
      await storage.setSync({
        preferences: {
          fontFamily: 'Georgia',
          codeFontFamily: 'JetBrains Mono',
          lineHeight: 1.6,
        },
      });

      const engineWithStorage = new ThemeEngine(storage);
      const overrides = await engineWithStorage.getStorageOverrides();
      const vars = engineWithStorage.compileToCSSVariables(githubDark, overrides);

      expect(vars['--md-font-family']).toBe('Georgia');
      expect(vars['--md-font-family-code']).toBe('JetBrains Mono');
      expect(vars['--md-line-height']).toBe('1.6');
      // Non-overridden values should still come from theme
      expect(vars['--md-bg']).toBe(githubDark.colors.background);
    });
  });

  describe('getAvailableThemes', () => {
    it('returns list of available themes', () => {
      const themes = engine.getAvailableThemes();
      expect(themes.length).toBe(9);
      const names = themes.map((t) => t.name);
      expect(names).toContain('github-light');
      expect(names).toContain('github-dark');
      expect(names).toContain('catppuccin-mocha');
    });

    it('each theme has name, displayName, and variant', () => {
      const themes = engine.getAvailableThemes();
      for (const t of themes) {
        expect(t.name).toBeTruthy();
        expect(t.displayName).toBeTruthy();
        expect(['light', 'dark']).toContain(t.variant);
      }
    });
  });

  describe('getCurrentTheme', () => {
    it('returns null before any theme is set', () => {
      expect(engine.getCurrentTheme()).toBeNull();
    });

    it('returns the theme after setCurrentTheme', () => {
      engine.setCurrentTheme(githubLight);
      expect(engine.getCurrentTheme()).toBe(githubLight);
    });
  });
});

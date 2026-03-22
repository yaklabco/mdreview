import { describe, it, expect, beforeEach } from 'vitest';
import {
  getFileIconSVG,
  isMarkdownFile,
  setIconTheme,
  getIconTheme,
  ICON_THEMES,
} from './file-icons';
import type { IconThemeId } from './file-icons';

describe('file-icons', () => {
  beforeEach(() => {
    setIconTheme('lucide');
  });

  describe('ICON_THEMES registry', () => {
    it('exposes seven themes', () => {
      expect(ICON_THEMES).toHaveLength(7);
      const ids = ICON_THEMES.map((t) => t.id);
      expect(ids).toContain('lucide');
      expect(ids).toContain('codicons');
      expect(ids).toContain('symbols');
      expect(ids).toContain('one-dark');
      expect(ids).toContain('material');
      expect(ids).toContain('catppuccin');
      expect(ids).toContain('seti');
    });

    it('each theme has all required SVG keys', () => {
      const keys = ['folder', 'folderOpen', 'markdown', 'image', 'code', 'config', 'genericFile'] as const;
      for (const theme of ICON_THEMES) {
        for (const key of keys) {
          expect(theme[key]).toContain('<svg');
          expect(theme[key]).toContain('</svg>');
        }
      }
    });

    it('each theme has a displayName', () => {
      for (const theme of ICON_THEMES) {
        expect(theme.displayName.length).toBeGreaterThan(0);
      }
    });
  });

  describe('setIconTheme / getIconTheme', () => {
    it('defaults to lucide', () => {
      expect(getIconTheme()).toBe('lucide');
    });

    it('round-trips each theme id', () => {
      const ids: IconThemeId[] = ['lucide', 'codicons', 'symbols', 'one-dark', 'material', 'catppuccin', 'seti'];
      for (const id of ids) {
        setIconTheme(id);
        expect(getIconTheme()).toBe(id);
      }
    });
  });

  describe('theme-specific SVG attributes', () => {
    it('lucide icons use stroke="currentColor" and viewBox="0 0 24 24"', () => {
      setIconTheme('lucide');
      const svg = getFileIconSVG('readme.md', false);
      expect(svg).toContain('stroke="currentColor"');
      expect(svg).toContain('viewBox="0 0 24 24"');
    });

    it('codicons icons use fill="currentColor" and viewBox="0 0 16 16"', () => {
      setIconTheme('codicons');
      const svg = getFileIconSVG('readme.md', false);
      expect(svg).toContain('fill="currentColor"');
      expect(svg).toContain('viewBox="0 0 16 16"');
    });

    it('symbols icons use stroke="currentColor" and viewBox="0 0 24 24"', () => {
      setIconTheme('symbols');
      const svg = getFileIconSVG('readme.md', false);
      expect(svg).toContain('stroke="currentColor"');
      expect(svg).toContain('viewBox="0 0 24 24"');
    });

    it('one-dark icons use stroke="currentColor" and viewBox="0 0 24 24"', () => {
      setIconTheme('one-dark');
      const svg = getFileIconSVG('readme.md', false);
      expect(svg).toContain('stroke="currentColor"');
      expect(svg).toContain('viewBox="0 0 24 24"');
    });

    it('material icons use fill colors and viewBox="0 0 24 24"', () => {
      setIconTheme('material');
      const svg = getFileIconSVG('readme.md', false);
      expect(svg).toContain('fill=');
      expect(svg).toContain('viewBox="0 0 24 24"');
    });

    it('catppuccin icons use pastel stroke colors and viewBox="0 0 24 24"', () => {
      setIconTheme('catppuccin');
      const svg = getFileIconSVG('readme.md', false);
      expect(svg).toContain('stroke="#94e2d5"');
      expect(svg).toContain('viewBox="0 0 24 24"');
    });

    it('seti icons use fill colors and viewBox="0 0 24 24"', () => {
      setIconTheme('seti');
      const svg = getFileIconSVG('readme.md', false);
      expect(svg).toContain('fill=');
      expect(svg).toContain('viewBox="0 0 24 24"');
    });
  });

  describe('getFileIconSVG returns different SVGs per theme', () => {
    it('markdown icon differs between themes', () => {
      setIconTheme('lucide');
      const lucide = getFileIconSVG('readme.md', false);
      setIconTheme('codicons');
      const codicons = getFileIconSVG('readme.md', false);
      setIconTheme('symbols');
      const symbols = getFileIconSVG('readme.md', false);

      expect(lucide).not.toBe(codicons);
      expect(codicons).not.toBe(symbols);
    });

    it('folder icon differs between themes', () => {
      setIconTheme('lucide');
      const lucide = getFileIconSVG('docs', true, false);
      setIconTheme('codicons');
      const codicons = getFileIconSVG('docs', true, false);

      expect(lucide).not.toBe(codicons);
    });
  });

  describe('getFileIconSVG', () => {
    it('returns closed folder icon for collapsed directory', () => {
      const svg = getFileIconSVG('docs', true, false);
      expect(svg).toContain('<svg');
    });

    it('returns open folder icon for expanded directory', () => {
      const closed = getFileIconSVG('docs', true, false);
      const open = getFileIconSVG('docs', true, true);
      expect(open).not.toBe(closed);
    });

    it('returns closed folder icon when expanded is undefined', () => {
      const closed = getFileIconSVG('docs', true, false);
      const undef = getFileIconSVG('docs', true);
      expect(undef).toBe(closed);
    });

    it('returns markdown icon for .md files', () => {
      const svg = getFileIconSVG('readme.md', false);
      expect(svg).toContain('<svg');
    });

    it('returns markdown icon for .markdown files', () => {
      const md = getFileIconSVG('readme.md', false);
      const markdown = getFileIconSVG('notes.markdown', false);
      expect(markdown).toBe(md);
    });

    it('returns markdown icon for .mdx files', () => {
      const md = getFileIconSVG('readme.md', false);
      const mdx = getFileIconSVG('page.mdx', false);
      expect(mdx).toBe(md);
    });

    it('returns image icon for image files', () => {
      const img = getFileIconSVG('photo.png', false);
      expect(getFileIconSVG('logo.svg', false)).toBe(img);
      expect(getFileIconSVG('pic.jpg', false)).toBe(img);
      expect(getFileIconSVG('pic.jpeg', false)).toBe(img);
      expect(getFileIconSVG('anim.gif', false)).toBe(img);
      expect(getFileIconSVG('img.webp', false)).toBe(img);
      expect(getFileIconSVG('icon.ico', false)).toBe(img);
      expect(getFileIconSVG('bitmap.bmp', false)).toBe(img);
    });

    it('returns code icon for code files', () => {
      const code = getFileIconSVG('app.ts', false);
      expect(getFileIconSVG('index.tsx', false)).toBe(code);
      expect(getFileIconSVG('main.js', false)).toBe(code);
      expect(getFileIconSVG('main.py', false)).toBe(code);
      expect(getFileIconSVG('main.go', false)).toBe(code);
      expect(getFileIconSVG('lib.rs', false)).toBe(code);
      expect(getFileIconSVG('page.html', false)).toBe(code);
      expect(getFileIconSVG('style.css', false)).toBe(code);
      expect(getFileIconSVG('run.sh', false)).toBe(code);
    });

    it('returns config icon for config files', () => {
      const config = getFileIconSVG('package.json', false);
      expect(getFileIconSVG('config.yaml', false)).toBe(config);
      expect(getFileIconSVG('config.yml', false)).toBe(config);
      expect(getFileIconSVG('settings.toml', false)).toBe(config);
      expect(getFileIconSVG('pom.xml', false)).toBe(config);
      expect(getFileIconSVG('yarn.lock', false)).toBe(config);
      expect(getFileIconSVG('.env', false)).toBe(config);
    });

    it('returns generic icon for unknown extensions', () => {
      const generic = getFileIconSVG('readme.txt', false);
      expect(getFileIconSVG('data.dat', false)).toBe(generic);
      expect(getFileIconSVG('LICENSE', false)).toBe(generic);
    });

    it('is case-insensitive for extensions', () => {
      const md = getFileIconSVG('readme.md', false);
      expect(getFileIconSVG('README.MD', false)).toBe(md);
      const img = getFileIconSVG('photo.png', false);
      expect(getFileIconSVG('photo.PNG', false)).toBe(img);
      const cfg = getFileIconSVG('package.json', false);
      expect(getFileIconSVG('config.JSON', false)).toBe(cfg);
    });
  });

  describe('isMarkdownFile', () => {
    it('returns true for markdown extensions', () => {
      expect(isMarkdownFile('readme.md')).toBe(true);
      expect(isMarkdownFile('notes.markdown')).toBe(true);
      expect(isMarkdownFile('doc.mdown')).toBe(true);
      expect(isMarkdownFile('doc.mkd')).toBe(true);
      expect(isMarkdownFile('doc.mkdn')).toBe(true);
      expect(isMarkdownFile('page.mdx')).toBe(true);
    });

    it('returns false for non-markdown files', () => {
      expect(isMarkdownFile('app.ts')).toBe(false);
      expect(isMarkdownFile('style.css')).toBe(false);
      expect(isMarkdownFile('photo.png')).toBe(false);
      expect(isMarkdownFile('LICENSE')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isMarkdownFile('README.MD')).toBe(true);
      expect(isMarkdownFile('NOTES.MARKDOWN')).toBe(true);
    });
  });
});

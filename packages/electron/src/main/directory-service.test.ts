import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('chokidar', () => ({
  watch: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { DirectoryService } from './directory-service';
import { watch } from 'chokidar';

describe('DirectoryService', () => {
  let service: DirectoryService;
  let tmpDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DirectoryService();
    tmpDir = mkdtempSync(join(tmpdir(), 'mdreview-test-'));
  });

  afterEach(() => {
    service.dispose();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should list markdown files in a directory', async () => {
    writeFileSync(join(tmpDir, 'readme.md'), '# Hello');
    writeFileSync(join(tmpDir, 'notes.markdown'), '# Notes');

    const entries = await service.listDirectory(tmpDir);
    const names = entries.map((e) => e.name);

    expect(names).toContain('readme.md');
    expect(names).toContain('notes.markdown');
    expect(entries.every((e) => e.type === 'file')).toBe(true);
  });

  it('should sort directories first, then alphabetically', async () => {
    mkdirSync(join(tmpDir, 'zebra'));
    mkdirSync(join(tmpDir, 'alpha'));
    writeFileSync(join(tmpDir, 'beta.md'), '# B');
    writeFileSync(join(tmpDir, 'aaa.md'), '# A');

    const entries = await service.listDirectory(tmpDir);
    const names = entries.map((e) => e.name);

    // Directories first (alphabetically), then files (alphabetically)
    expect(names).toEqual(['alpha', 'zebra', 'aaa.md', 'beta.md']);
  });

  it('should filter out non-markdown files', async () => {
    writeFileSync(join(tmpDir, 'readme.md'), '# Hello');
    writeFileSync(join(tmpDir, 'image.png'), 'binary');
    writeFileSync(join(tmpDir, 'style.css'), 'body {}');
    writeFileSync(join(tmpDir, 'data.json'), '{}');

    const entries = await service.listDirectory(tmpDir);

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('readme.md');
  });

  it('should list immediate children only', async () => {
    mkdirSync(join(tmpDir, 'docs'));
    writeFileSync(join(tmpDir, 'docs', 'guide.md'), '# Guide');
    mkdirSync(join(tmpDir, 'docs', 'api'));
    writeFileSync(join(tmpDir, 'docs', 'api', 'reference.md'), '# Ref');
    writeFileSync(join(tmpDir, 'readme.md'), '# Root');

    const entries = await service.listDirectory(tmpDir);

    // Should have docs/ directory and readme.md
    expect(entries).toHaveLength(2);

    const docsDir = entries.find((e) => e.name === 'docs');
    expect(docsDir).toBeDefined();
    expect(docsDir!.type).toBe('directory');
    // Shallow: children are undefined (not loaded yet)
    expect(docsDir!.children).toBeUndefined();
  });

  it('should support incremental loading via successive calls', async () => {
    mkdirSync(join(tmpDir, 'docs'));
    writeFileSync(join(tmpDir, 'docs', 'guide.md'), '# Guide');
    mkdirSync(join(tmpDir, 'docs', 'api'));
    writeFileSync(join(tmpDir, 'docs', 'api', 'reference.md'), '# Ref');
    writeFileSync(join(tmpDir, 'readme.md'), '# Root');

    // First call: root level
    const rootEntries = await service.listDirectory(tmpDir);
    expect(rootEntries).toHaveLength(2);
    const docsDir = rootEntries.find((e) => e.name === 'docs');
    expect(docsDir!.children).toBeUndefined();

    // Second call: expand docs/
    const docsEntries = await service.listDirectory(join(tmpDir, 'docs'));
    expect(docsEntries).toHaveLength(2); // api/ and guide.md
    const apiDir = docsEntries.find((e) => e.name === 'api');
    expect(apiDir).toBeDefined();
    expect(apiDir!.type).toBe('directory');
    expect(apiDir!.children).toBeUndefined();
    const guideFile = docsEntries.find((e) => e.name === 'guide.md');
    expect(guideFile).toBeDefined();
    expect(guideFile!.type).toBe('file');
  });

  it('should handle empty directory', async () => {
    const entries = await service.listDirectory(tmpDir);
    expect(entries).toEqual([]);
  });

  it('should handle nonexistent directory gracefully', async () => {
    const entries = await service.listDirectory(join(tmpDir, 'nonexistent'));
    expect(entries).toEqual([]);
  });

  it('should include all non-hidden, non-excluded directories', async () => {
    mkdirSync(join(tmpDir, 'images'));
    writeFileSync(join(tmpDir, 'images', 'photo.png'), 'binary');
    mkdirSync(join(tmpDir, 'docs'));
    writeFileSync(join(tmpDir, 'docs', 'guide.md'), '# Guide');

    const entries = await service.listDirectory(tmpDir);

    const names = entries.map((e) => e.name);
    // With shallow loading, all dirs appear (we don't know contents yet)
    expect(names).toContain('images');
    expect(names).toContain('docs');
  });

  it('should exclude hidden files and directories', async () => {
    mkdirSync(join(tmpDir, '.git'));
    writeFileSync(join(tmpDir, '.hidden'), 'secret');
    writeFileSync(join(tmpDir, 'readme.md'), '# Hello');

    const entries = await service.listDirectory(tmpDir);
    const names = entries.map((e) => e.name);

    expect(names).not.toContain('.git');
    expect(names).not.toContain('.hidden');
    expect(names).toContain('readme.md');
  });

  it('should exclude node_modules directory', async () => {
    mkdirSync(join(tmpDir, 'node_modules'));
    writeFileSync(join(tmpDir, 'node_modules', 'pkg.js'), 'module');
    mkdirSync(join(tmpDir, 'src'));
    writeFileSync(join(tmpDir, 'readme.md'), '# Hello');

    const entries = await service.listDirectory(tmpDir);
    const names = entries.map((e) => e.name);

    expect(names).not.toContain('node_modules');
    expect(names).toContain('src');
  });

  it('should watch and call back on changes', () => {
    const callback = vi.fn();
    service.watchDirectory(tmpDir, callback);

    expect(watch).toHaveBeenCalledWith(
      tmpDir,
      expect.objectContaining({
        ignoreInitial: true,
      })
    );
  });

  it('should dispose all watchers', () => {
    const mockWatcher = {
      on: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(watch).mockReturnValue(mockWatcher as never);

    service.watchDirectory(tmpDir, vi.fn());
    service.watchDirectory(join(tmpDir, 'other'), vi.fn());
    service.dispose();

    expect(mockWatcher.close).toHaveBeenCalledTimes(2);
  });

  it('should unwatch a specific directory', () => {
    const mockWatcher = {
      on: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(watch).mockReturnValue(mockWatcher as never);

    service.watchDirectory(tmpDir, vi.fn());
    service.unwatchDirectory(tmpDir);

    expect(mockWatcher.close).toHaveBeenCalledTimes(1);
  });

  it('should recognize all markdown extensions', async () => {
    const extensions = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx'];
    for (const ext of extensions) {
      writeFileSync(join(tmpDir, `file${ext}`), '# Test');
    }

    const entries = await service.listDirectory(tmpDir);
    expect(entries).toHaveLength(extensions.length);
  });

  describe('showAllFiles option', () => {
    it('should include non-markdown files when showAllFiles is true', async () => {
      writeFileSync(join(tmpDir, 'readme.md'), '# Hello');
      writeFileSync(join(tmpDir, 'image.png'), 'binary');
      writeFileSync(join(tmpDir, 'style.css'), 'body {}');
      writeFileSync(join(tmpDir, 'data.json'), '{}');

      const entries = await service.listDirectory(tmpDir, { showAllFiles: true });

      const names = entries.map((e) => e.name);
      expect(names).toContain('readme.md');
      expect(names).toContain('image.png');
      expect(names).toContain('style.css');
      expect(names).toContain('data.json');
      expect(entries).toHaveLength(4);
    });

    it('should still exclude hidden files when showAllFiles is true', async () => {
      writeFileSync(join(tmpDir, '.hidden'), 'secret');
      writeFileSync(join(tmpDir, 'visible.txt'), 'hello');

      const entries = await service.listDirectory(tmpDir, { showAllFiles: true });

      const names = entries.map((e) => e.name);
      expect(names).not.toContain('.hidden');
      expect(names).toContain('visible.txt');
    });

    it('should exclude node_modules directory when showAllFiles is true', async () => {
      mkdirSync(join(tmpDir, 'node_modules'));
      writeFileSync(join(tmpDir, 'node_modules', 'pkg.js'), 'module');
      mkdirSync(join(tmpDir, 'src'));
      writeFileSync(join(tmpDir, 'src', 'app.ts'), 'code');

      const entries = await service.listDirectory(tmpDir, { showAllFiles: true });

      const names = entries.map((e) => e.name);
      expect(names).not.toContain('node_modules');
      expect(names).toContain('src');
    });

    it('should show all directories regardless of contents when showAllFiles is true', async () => {
      mkdirSync(join(tmpDir, 'images'));
      writeFileSync(join(tmpDir, 'images', 'photo.png'), 'binary');

      const allEntries = await service.listDirectory(tmpDir, { showAllFiles: true });
      expect(allEntries.map((e) => e.name)).toContain('images');
    });

    it('should default to markdown-only when options not provided', async () => {
      writeFileSync(join(tmpDir, 'readme.md'), '# Hello');
      writeFileSync(join(tmpDir, 'image.png'), 'binary');

      const entries = await service.listDirectory(tmpDir);

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('readme.md');
    });

    it('should default to markdown-only when showAllFiles is false', async () => {
      writeFileSync(join(tmpDir, 'readme.md'), '# Hello');
      writeFileSync(join(tmpDir, 'image.png'), 'binary');

      const entries = await service.listDirectory(tmpDir, { showAllFiles: false });

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('readme.md');
    });
  });
});

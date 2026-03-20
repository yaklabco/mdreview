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
    tmpDir = mkdtempSync(join(tmpdir(), 'mdview-test-'));
  });

  afterEach(() => {
    service.dispose();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should list markdown files in a directory', () => {
    writeFileSync(join(tmpDir, 'readme.md'), '# Hello');
    writeFileSync(join(tmpDir, 'notes.markdown'), '# Notes');

    const entries = service.listDirectory(tmpDir);
    const names = entries.map((e) => e.name);

    expect(names).toContain('readme.md');
    expect(names).toContain('notes.markdown');
    expect(entries.every((e) => e.type === 'file')).toBe(true);
  });

  it('should sort directories first, then alphabetically', () => {
    mkdirSync(join(tmpDir, 'zebra'));
    writeFileSync(join(tmpDir, 'zebra', 'file.md'), '# Z');
    mkdirSync(join(tmpDir, 'alpha'));
    writeFileSync(join(tmpDir, 'alpha', 'file.md'), '# A');
    writeFileSync(join(tmpDir, 'beta.md'), '# B');
    writeFileSync(join(tmpDir, 'aaa.md'), '# A');

    const entries = service.listDirectory(tmpDir);
    const names = entries.map((e) => e.name);

    // Directories first (alphabetically), then files (alphabetically)
    expect(names).toEqual(['alpha', 'zebra', 'aaa.md', 'beta.md']);
  });

  it('should filter out non-markdown files', () => {
    writeFileSync(join(tmpDir, 'readme.md'), '# Hello');
    writeFileSync(join(tmpDir, 'image.png'), 'binary');
    writeFileSync(join(tmpDir, 'style.css'), 'body {}');
    writeFileSync(join(tmpDir, 'data.json'), '{}');

    const entries = service.listDirectory(tmpDir);

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('readme.md');
  });

  it('should build recursive tree structure', () => {
    mkdirSync(join(tmpDir, 'docs'));
    writeFileSync(join(tmpDir, 'docs', 'guide.md'), '# Guide');
    mkdirSync(join(tmpDir, 'docs', 'api'));
    writeFileSync(join(tmpDir, 'docs', 'api', 'reference.md'), '# Ref');
    writeFileSync(join(tmpDir, 'readme.md'), '# Root');

    const entries = service.listDirectory(tmpDir);

    // Should have docs/ directory and readme.md
    expect(entries).toHaveLength(2);

    const docsDir = entries.find((e) => e.name === 'docs');
    expect(docsDir).toBeDefined();
    expect(docsDir!.type).toBe('directory');
    expect(docsDir!.children).toBeDefined();
    expect(docsDir!.children).toHaveLength(2); // api/ and guide.md

    const apiDir = docsDir!.children!.find((e) => e.name === 'api');
    expect(apiDir).toBeDefined();
    expect(apiDir!.type).toBe('directory');
    expect(apiDir!.children).toHaveLength(1);
    expect(apiDir!.children![0].name).toBe('reference.md');
  });

  it('should handle empty directory', () => {
    const entries = service.listDirectory(tmpDir);
    expect(entries).toEqual([]);
  });

  it('should handle nonexistent directory gracefully', () => {
    const entries = service.listDirectory(join(tmpDir, 'nonexistent'));
    expect(entries).toEqual([]);
  });

  it('should exclude directories that contain no markdown files', () => {
    mkdirSync(join(tmpDir, 'images'));
    writeFileSync(join(tmpDir, 'images', 'photo.png'), 'binary');
    mkdirSync(join(tmpDir, 'docs'));
    writeFileSync(join(tmpDir, 'docs', 'guide.md'), '# Guide');

    const entries = service.listDirectory(tmpDir);

    const names = entries.map((e) => e.name);
    expect(names).not.toContain('images');
    expect(names).toContain('docs');
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

  it('should recognize all markdown extensions', () => {
    const extensions = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx'];
    for (const ext of extensions) {
      writeFileSync(join(tmpDir, `file${ext}`), '# Test');
    }

    const entries = service.listDirectory(tmpDir);
    expect(entries).toHaveLength(extensions.length);
  });
});

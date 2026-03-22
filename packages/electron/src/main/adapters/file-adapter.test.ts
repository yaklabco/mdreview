import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ElectronFileAdapter } from './file-adapter';
import { writeFile, mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ElectronFileAdapter', () => {
  let adapter: ElectronFileAdapter;
  let tempDir: string;

  beforeEach(async () => {
    adapter = new ElectronFileAdapter();
    tempDir = await mkdtemp(join(tmpdir(), 'mdreview-test-'));
  });

  afterEach(async () => {
    adapter.dispose();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('readFile', () => {
    it('should read file contents', async () => {
      const filePath = join(tempDir, 'test.md');
      await writeFile(filePath, '# Hello World');
      const content = await adapter.readFile(filePath);
      expect(content).toBe('# Hello World');
    });

    it('should throw for non-existent file', async () => {
      await expect(adapter.readFile(join(tempDir, 'missing.md'))).rejects.toThrow();
    });

    it('should read UTF-8 content correctly', async () => {
      const filePath = join(tempDir, 'unicode.md');
      await writeFile(filePath, '# Héllo Wörld 日本語');
      const content = await adapter.readFile(filePath);
      expect(content).toBe('# Héllo Wörld 日本語');
    });
  });

  describe('writeFile', () => {
    it('should write content to file', async () => {
      const filePath = join(tempDir, 'output.md');
      const result = await adapter.writeFile(filePath, '# New Content');
      expect(result.success).toBe(true);
      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('# New Content');
    });

    it('should overwrite existing file', async () => {
      const filePath = join(tempDir, 'existing.md');
      await writeFile(filePath, 'old');
      const result = await adapter.writeFile(filePath, 'new');
      expect(result.success).toBe(true);
      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('new');
    });

    it('should return error for invalid path', async () => {
      const result = await adapter.writeFile(
        join(tempDir, 'nonexistent-dir', 'file.md'),
        'content'
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('checkChanged', () => {
    it('should detect changed file', async () => {
      const filePath = join(tempDir, 'check.md');
      await writeFile(filePath, 'original');
      const result = await adapter.checkChanged(filePath, 'wrong-hash');
      expect(result.changed).toBe(true);
      expect(result.newHash).toBeDefined();
    });

    it('should detect unchanged file', async () => {
      const filePath = join(tempDir, 'check.md');
      await writeFile(filePath, 'content');
      const first = await adapter.checkChanged(filePath, '');
      const second = await adapter.checkChanged(filePath, first.newHash ?? '');
      expect(second.changed).toBe(false);
    });

    it('should return error for missing file', async () => {
      const result = await adapter.checkChanged(join(tempDir, 'nope.md'), 'hash');
      expect(result.error).toBeDefined();
    });
  });

  describe('watch', () => {
    it('should call callback when file changes', async () => {
      const filePath = join(tempDir, 'watch.md');
      await writeFile(filePath, 'initial');

      let called = false;
      const unwatch = adapter.watch(filePath, () => {
        called = true;
      });

      // Wait for watcher to be ready
      await new Promise((r) => setTimeout(r, 200));

      await writeFile(filePath, 'changed');

      // Wait for change detection
      await new Promise((r) => setTimeout(r, 500));

      expect(called).toBe(true);
      unwatch();
    });

    it('should stop watching after unsubscribe', async () => {
      const filePath = join(tempDir, 'watch2.md');
      await writeFile(filePath, 'initial');

      let callCount = 0;
      const unwatch = adapter.watch(filePath, () => {
        callCount++;
      });

      await new Promise((r) => setTimeout(r, 200));
      unwatch();

      await writeFile(filePath, 'changed');
      await new Promise((r) => setTimeout(r, 500));

      expect(callCount).toBe(0);
    });
  });
});

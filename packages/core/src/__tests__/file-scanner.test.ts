import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileScanner } from '../utils/file-scanner';
import type { FileAdapter, FileChangeInfo } from '../adapters';
import { NoopFileAdapter } from '../adapters';

describe('FileScanner (core)', () => {
  describe('hasMarkdownExtension', () => {
    it('recognizes .md files', () => {
      expect(FileScanner.hasMarkdownExtension('/path/to/file.md')).toBe(true);
    });

    it('recognizes .markdown files', () => {
      expect(FileScanner.hasMarkdownExtension('/path/to/file.markdown')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(FileScanner.hasMarkdownExtension('/path/to/FILE.MD')).toBe(true);
      expect(FileScanner.hasMarkdownExtension('/path/to/README.Markdown')).toBe(true);
    });

    it('rejects non-markdown extensions', () => {
      expect(FileScanner.hasMarkdownExtension('/path/to/file.txt')).toBe(false);
      expect(FileScanner.hasMarkdownExtension('/path/to/file.html')).toBe(false);
      expect(FileScanner.hasMarkdownExtension('/path/to/file.js')).toBe(false);
    });
  });

  describe('matchesPattern (blocklist)', () => {
    it('matches exact hostname', () => {
      expect(
        FileScanner.matchesBlocklistPattern('github.com', 'https://github.com/repo', 'github.com', '/repo')
      ).toBe(true);
    });

    it('does not match different hostname', () => {
      expect(
        FileScanner.matchesBlocklistPattern('gitlab.com', 'https://github.com/repo', 'github.com', '/repo')
      ).toBe(false);
    });

    it('matches wildcard subdomain', () => {
      expect(
        FileScanner.matchesBlocklistPattern('*.github.com', 'https://raw.github.com/file', 'raw.github.com', '/file')
      ).toBe(true);
    });

    it('matches wildcard subdomain against base domain', () => {
      expect(
        FileScanner.matchesBlocklistPattern('*.github.com', 'https://github.com/file', 'github.com', '/file')
      ).toBe(true);
    });

    it('matches path pattern', () => {
      expect(
        FileScanner.matchesBlocklistPattern('github.com/*/blob/*', 'https://github.com/user/blob/main', 'github.com', '/user/blob/main')
      ).toBe(true);
    });

    it('matches full URL pattern', () => {
      expect(
        FileScanner.matchesBlocklistPattern('https://raw.githubusercontent.com/*', 'https://raw.githubusercontent.com/file.md', 'raw.githubusercontent.com', '/file.md')
      ).toBe(true);
    });

    it('rejects empty pattern', () => {
      expect(
        FileScanner.matchesBlocklistPattern('', 'https://github.com', 'github.com', '/')
      ).toBe(false);
    });

    it('rejects whitespace-only pattern', () => {
      expect(
        FileScanner.matchesBlocklistPattern('   ', 'https://github.com', 'github.com', '/')
      ).toBe(false);
    });
  });

  describe('isSiteBlockedFromList', () => {
    it('returns false for empty blocklist', () => {
      expect(FileScanner.isSiteBlockedFromList([], 'https://github.com', 'github.com', '/')).toBe(false);
    });

    it('returns true when URL matches a pattern', () => {
      expect(
        FileScanner.isSiteBlockedFromList(
          ['github.com', '*.gitlab.com'],
          'https://github.com/repo/file.md',
          'github.com',
          '/repo/file.md'
        )
      ).toBe(true);
    });

    it('returns false when URL does not match any pattern', () => {
      expect(
        FileScanner.isSiteBlockedFromList(
          ['github.com', '*.gitlab.com'],
          'https://example.com/file.md',
          'example.com',
          '/file.md'
        )
      ).toBe(false);
    });
  });

  describe('generateHash', () => {
    it('produces consistent hash for same content', async () => {
      const hash1 = await FileScanner.generateHash('hello world');
      const hash2 = await FileScanner.generateHash('hello world');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different content', async () => {
      // The global test setup mocks crypto.subtle.digest to always return
      // zeroed ArrayBuffer(32). Override it to return content-dependent results.
      let callCount = 0;
      const originalDigest = crypto.subtle.digest;
      crypto.subtle.digest = vi.fn(async () => {
        callCount++;
        const buf = new ArrayBuffer(32);
        const view = new Uint8Array(buf);
        view[0] = callCount; // Make each call return a unique hash
        return buf;
      });

      try {
        const hash1 = await FileScanner.generateHash('hello world');
        const hash2 = await FileScanner.generateHash('goodbye world');
        expect(hash1).not.toBe(hash2);
      } finally {
        crypto.subtle.digest = originalDigest;
      }
    });

    it('returns a hex string', async () => {
      const hash = await FileScanner.generateHash('test');
      // The global mock returns zeroed ArrayBuffer(32), which yields 64 hex '0' chars
      expect(hash).toMatch(/^[0-9a-f]+$/);
      expect(hash).toHaveLength(64);
    });
  });

  describe('validateFileSize', () => {
    it('accepts content within size limit', () => {
      expect(FileScanner.validateFileSize('small content')).toBe(true);
    });

    it('accepts content at exact limit', () => {
      const content = 'x'.repeat(100);
      expect(FileScanner.validateFileSize(content, 100)).toBe(true);
    });

    it('rejects content exceeding limit', () => {
      const content = 'x'.repeat(200);
      expect(FileScanner.validateFileSize(content, 100)).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      expect(FileScanner.formatFileSize(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(FileScanner.formatFileSize(2048)).toBe('2.0 KB');
    });

    it('formats megabytes', () => {
      expect(FileScanner.formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
    });
  });

  describe('getFileSize', () => {
    it('returns byte length of content', () => {
      const size = FileScanner.getFileSize('abc');
      expect(size).toBe(3);
    });
  });

  describe('watchFile with FileAdapter', () => {
    let mockAdapter: FileAdapter;

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calls callback when file has changed', async () => {
      mockAdapter = {
        writeFile: vi.fn(),
        readFile: vi.fn(),
        checkChanged: vi.fn().mockResolvedValue({ changed: true, newHash: 'new-hash-123' } as FileChangeInfo),
        watch: vi.fn().mockReturnValue(() => {}),
      };

      const callback = vi.fn();
      const cleanup = FileScanner.watchFile(
        'file:///test.md',
        'initial-hash',
        callback,
        { fileAdapter: mockAdapter, interval: 1000 }
      );

      // Advance timer to trigger the check
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockAdapter.checkChanged).toHaveBeenCalledWith('file:///test.md', 'initial-hash');
      expect(callback).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('does not call callback when file has not changed', async () => {
      mockAdapter = {
        writeFile: vi.fn(),
        readFile: vi.fn(),
        checkChanged: vi.fn().mockResolvedValue({ changed: false } as FileChangeInfo),
        watch: vi.fn().mockReturnValue(() => {}),
      };

      const callback = vi.fn();
      const cleanup = FileScanner.watchFile(
        'file:///test.md',
        'initial-hash',
        callback,
        { fileAdapter: mockAdapter, interval: 1000 }
      );

      await vi.advanceTimersByTimeAsync(1000);

      expect(mockAdapter.checkChanged).toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();

      cleanup();
    });

    it('updates lastHash after change is detected', async () => {
      mockAdapter = {
        writeFile: vi.fn(),
        readFile: vi.fn(),
        checkChanged: vi.fn()
          .mockResolvedValueOnce({ changed: true, newHash: 'second-hash' } as FileChangeInfo)
          .mockResolvedValueOnce({ changed: false } as FileChangeInfo),
        watch: vi.fn().mockReturnValue(() => {}),
      };

      const callback = vi.fn();
      const cleanup = FileScanner.watchFile(
        'file:///test.md',
        'first-hash',
        callback,
        { fileAdapter: mockAdapter, interval: 1000 }
      );

      // First check — file changed
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockAdapter.checkChanged).toHaveBeenCalledWith('file:///test.md', 'first-hash');

      // Second check — should use the updated hash
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockAdapter.checkChanged).toHaveBeenCalledWith('file:///test.md', 'second-hash');

      cleanup();
    });

    it('handles adapter errors gracefully', async () => {
      mockAdapter = {
        writeFile: vi.fn(),
        readFile: vi.fn(),
        checkChanged: vi.fn().mockRejectedValue(new Error('Network error')),
        watch: vi.fn().mockReturnValue(() => {}),
      };

      const callback = vi.fn();
      const cleanup = FileScanner.watchFile(
        'file:///test.md',
        'initial-hash',
        callback,
        { fileAdapter: mockAdapter, interval: 1000 }
      );

      // Should not throw
      await vi.advanceTimersByTimeAsync(1000);

      expect(callback).not.toHaveBeenCalled();

      cleanup();
    });

    it('handles adapter error response gracefully', async () => {
      mockAdapter = {
        writeFile: vi.fn(),
        readFile: vi.fn(),
        checkChanged: vi.fn().mockResolvedValue({ changed: false, error: 'File not found' } as FileChangeInfo),
        watch: vi.fn().mockReturnValue(() => {}),
      };

      const callback = vi.fn();
      const cleanup = FileScanner.watchFile(
        'file:///test.md',
        'initial-hash',
        callback,
        { fileAdapter: mockAdapter, interval: 1000 }
      );

      await vi.advanceTimersByTimeAsync(1000);

      expect(callback).not.toHaveBeenCalled();

      cleanup();
    });

    it('cleanup function stops polling', async () => {
      mockAdapter = {
        writeFile: vi.fn(),
        readFile: vi.fn(),
        checkChanged: vi.fn().mockResolvedValue({ changed: true, newHash: 'new' } as FileChangeInfo),
        watch: vi.fn().mockReturnValue(() => {}),
      };

      const callback = vi.fn();
      const cleanup = FileScanner.watchFile(
        'file:///test.md',
        'initial-hash',
        callback,
        { fileAdapter: mockAdapter, interval: 1000 }
      );

      // Stop before any tick
      cleanup();

      await vi.advanceTimersByTimeAsync(5000);

      expect(mockAdapter.checkChanged).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('watchFile without adapter (graceful degradation)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns a cleanup function without an adapter', () => {
      const callback = vi.fn();
      const cleanup = FileScanner.watchFile(
        'file:///test.md',
        'initial-hash',
        callback,
        {}
      );

      expect(typeof cleanup).toBe('function');
      cleanup(); // should not throw
    });

    it('never calls callback without an adapter', async () => {
      const callback = vi.fn();
      const cleanup = FileScanner.watchFile(
        'file:///test.md',
        'initial-hash',
        callback,
        {}
      );

      await vi.advanceTimersByTimeAsync(5000);

      expect(callback).not.toHaveBeenCalled();

      cleanup();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import { handleMessage, validatePath } from './host-logic';
import type { HostMessage } from './host-logic';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('os', () => ({
  userInfo: vi.fn(),
}));

describe('host-logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Ping handler
  // -----------------------------------------------------------------------

  describe('ping action', () => {
    it('returns { success: true, seq: 0 } with no seq provided', () => {
      const result = handleMessage({ action: 'ping' });
      expect(result).toEqual({ success: true, seq: 0 });
    });

    it('echoes back the provided seq number', () => {
      const result = handleMessage({ action: 'ping', seq: 7 });
      expect(result).toEqual({ success: true, seq: 7 });
    });

    it('returns { success: true, seq: 42 } with seq: 42', () => {
      const result = handleMessage({ action: 'ping', seq: 42 });
      expect(result).toEqual({ success: true, seq: 42 });
    });
  });

  // -----------------------------------------------------------------------
  // Existing handlers (regression coverage)
  // -----------------------------------------------------------------------

  describe('get_username action', () => {
    it('returns the username from os.userInfo()', () => {
      vi.mocked(os.userInfo).mockReturnValue({
        username: 'testuser',
        uid: 1000,
        gid: 1000,
        homedir: '/home/testuser',
        shell: '/bin/bash',
      });

      const result = handleMessage({ action: 'get_username' });
      expect(result).toEqual({ success: true, username: 'testuser' });
    });
  });

  describe('validatePath', () => {
    it('returns null for .md files', () => {
      expect(validatePath('/tmp/file.md')).toBeNull();
    });

    it('returns null for .markdown files', () => {
      expect(validatePath('/tmp/file.markdown')).toBeNull();
    });

    it('returns null for .mdx files', () => {
      expect(validatePath('/tmp/file.mdx')).toBeNull();
    });

    it('returns error for non-markdown files', () => {
      expect(validatePath('/tmp/file.txt')).toMatch(/not a markdown file/);
    });
  });

  describe('invalid messages', () => {
    it('returns error for null message', () => {
      const result = handleMessage(null);
      expect(result).toEqual({ error: 'Invalid message format' });
    });

    it('returns error for string message', () => {
      const result = handleMessage('hello');
      expect(result).toEqual({ error: 'Invalid message format' });
    });

    it('returns error for unknown action', () => {
      const result = handleMessage({ action: 'unknown' } as HostMessage);
      expect(result).toEqual({ error: 'Unknown action: unknown' });
    });
  });

  describe('write action', () => {
    it('returns error for missing path', () => {
      const result = handleMessage({ action: 'write', content: 'hello' });
      expect(result).toEqual({ error: 'Missing or invalid path' });
    });

    it('returns error for missing content', () => {
      const result = handleMessage({ action: 'write', path: '/tmp/test.md' });
      expect(result).toEqual({ error: 'Missing content' });
    });

    it('returns error for non-markdown path', () => {
      const result = handleMessage({
        action: 'write',
        path: '/tmp/test.txt',
        content: 'hello',
      });
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toMatch(/not a markdown file/);
    });

    it('writes content to a markdown file', () => {
      const existing = '# Hello\n\nWorld';
      vi.mocked(fs.readFileSync).mockReturnValue(existing);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const result = handleMessage({
        action: 'write',
        path: '/tmp/test.md',
        content: existing,
      });

      expect(result).toEqual({ success: true });
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });
});

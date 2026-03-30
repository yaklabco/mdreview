/**
 * Tests for Native Messaging Host message handling logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import {
  validatePath,
  handleMessage,
  ALLOWED_EXTENSIONS,
} from '../../../packages/chrome-ext/src/native-host/host-logic';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('os', () => ({
  userInfo: vi.fn(),
}));

describe('Native Host Message Handling', () => {
  describe('ALLOWED_EXTENSIONS', () => {
    it('should include .md, .markdown, and .mdx', () => {
      expect(ALLOWED_EXTENSIONS).toContain('.md');
      expect(ALLOWED_EXTENSIONS).toContain('.markdown');
      expect(ALLOWED_EXTENSIONS).toContain('.mdx');
    });

    it('should not include non-markdown extensions', () => {
      expect(ALLOWED_EXTENSIONS).not.toContain('.js');
      expect(ALLOWED_EXTENSIONS).not.toContain('.ts');
      expect(ALLOWED_EXTENSIONS).not.toContain('.html');
      expect(ALLOWED_EXTENSIONS).not.toContain('.sh');
    });
  });

  describe('validatePath', () => {
    it('should accept .md files', () => {
      expect(validatePath('/path/to/file.md')).toBeNull();
    });

    it('should accept .markdown files', () => {
      expect(validatePath('/path/to/file.markdown')).toBeNull();
    });

    it('should accept .mdx files', () => {
      expect(validatePath('/path/to/file.mdx')).toBeNull();
    });

    it('should accept uppercase extensions', () => {
      expect(validatePath('/path/to/file.MD')).toBeNull();
      expect(validatePath('/path/to/file.Markdown')).toBeNull();
      expect(validatePath('/path/to/file.MDX')).toBeNull();
    });

    it('should reject .js files', () => {
      expect(validatePath('/path/to/file.js')).toMatch(/not a markdown file/);
    });

    it('should reject .sh files', () => {
      expect(validatePath('/path/to/file.sh')).toMatch(/not a markdown file/);
    });

    it('should reject .html files', () => {
      expect(validatePath('/path/to/file.html')).toMatch(/not a markdown file/);
    });

    it('should reject files with no extension', () => {
      expect(validatePath('/path/to/file')).toMatch(/not a markdown file/);
    });

    it('should include the rejected extension in the error message', () => {
      const result = validatePath('/path/to/script.py');
      expect(result).toContain('.py');
    });
  });

  describe('handleMessage', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should return error for null message', () => {
      const result = handleMessage(null);
      expect(result).toEqual({ error: 'Invalid message format' });
    });

    it('should return error for non-object message', () => {
      const result = handleMessage('string' as any);
      expect(result).toEqual({ error: 'Invalid message format' });
    });

    it('should return error for unknown action', () => {
      const result = handleMessage({ action: 'delete', path: '/a.md', content: '' });
      expect(result).toEqual({ error: 'Unknown action: delete' });
    });

    it('should return error for missing action', () => {
      const result = handleMessage({ path: '/a.md', content: '' } as any);
      expect(result).toEqual({ error: 'Unknown action: undefined' });
    });

    it('should return error for missing path', () => {
      const result = handleMessage({ action: 'write', content: 'hello' });
      expect(result).toEqual({ error: 'Missing or invalid path' });
    });

    it('should return error for non-string path', () => {
      const result = handleMessage({ action: 'write', path: 123, content: 'hello' } as any);
      expect(result).toEqual({ error: 'Missing or invalid path' });
    });

    it('should return error for missing content', () => {
      const result = handleMessage({ action: 'write', path: '/path/to/file.md' });
      expect(result).toEqual({ error: 'Missing content' });
    });

    it('should return error for null content', () => {
      const result = handleMessage({ action: 'write', path: '/path/to/file.md', content: null });
      expect(result).toEqual({ error: 'Missing content' });
    });

    it('should return error for non-markdown file path', () => {
      const result = handleMessage({ action: 'write', path: '/path/to/file.js', content: 'hello' });
      expect((result as { error: string }).error).toMatch(/not a markdown file/);
    });

    it('should write file and return success for valid message', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('# Hello World');
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const result = handleMessage({
        action: 'write',
        path: '/path/to/file.md',
        content: '# Hello World',
      });

      expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/file.md', '# Hello World', 'utf8');
      expect(result).toEqual({ success: true });
    });

    it('should return error when writeFileSync throws', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = handleMessage({
        action: 'write',
        path: '/path/to/file.md',
        content: '# Hello',
      });

      expect(result).toEqual({ error: 'EACCES: permission denied' });
    });

    it('should accept empty string as content', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('');
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const result = handleMessage({
        action: 'write',
        path: '/path/to/file.md',
        content: '',
      });

      expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/file.md', '', 'utf8');
      expect(result).toEqual({ success: true });
    });

    it('should work with .markdown extension', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('content');
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const result = handleMessage({
        action: 'write',
        path: '/docs/readme.markdown',
        content: 'content',
      });

      expect(fs.writeFileSync).toHaveBeenCalledWith('/docs/readme.markdown', 'content', 'utf8');
      expect(result).toEqual({ success: true });
    });

    it('should work with .mdx extension', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('import { Component } from "react"');
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const result = handleMessage({
        action: 'write',
        path: '/docs/page.mdx',
        content: 'import { Component } from "react"',
      });

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/docs/page.mdx',
        'import { Component } from "react"',
        'utf8'
      );
      expect(result).toEqual({ success: true });
    });

    it('should accept v1 comment marker changes', () => {
      const existing = '# Doc\n\nSome text here.';
      const withComment =
        '# Doc\n\nSome text[^comment-1] here.\n\n<!-- mdview:comments -->\n[^comment-1]: <!-- mdview:comment {"author":"a","date":"2026-01-01T00:00:00Z"} -->\n    note';
      vi.mocked(fs.readFileSync).mockReturnValue(existing);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const result = handleMessage({
        action: 'write',
        path: '/path/to/file.md',
        content: withComment,
      });

      expect(result).toEqual({ success: true });
    });

    it('should accept v2 annotation marker changes', () => {
      const existing = '# Doc\n\nSome text here.';
      const withAnnotation =
        '# Doc\n\nSome text[@1] here.\n\n<!-- mdview:annotations [{"id":1,"anchor":{"text":"text"},"body":"note","author":"a","date":"2026-01-01T00:00:00Z"}] -->';
      vi.mocked(fs.readFileSync).mockReturnValue(existing);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const result = handleMessage({
        action: 'write',
        path: '/path/to/file.md',
        content: withAnnotation,
      });

      expect(result).toEqual({ success: true });
    });

    it('should detect v2 sentinel as content boundary', () => {
      const existing = '# Doc\n\nSome text[@1] here.\n\n<!-- mdview:annotations [{"id":1}] -->';
      const updated =
        '# Doc\n\nSome text[@1][@2] here.\n\n<!-- mdview:annotations [{"id":1},{"id":2}] -->';
      vi.mocked(fs.readFileSync).mockReturnValue(existing);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const result = handleMessage({
        action: 'write',
        path: '/path/to/file.md',
        content: updated,
      });

      expect(result).toEqual({ success: true });
    });

    it('should accept v1 to v2 migration write', () => {
      const existing =
        '# Doc\n\nSome text[^comment-1] here.\n\n<!-- mdview:comments -->\n[^comment-1]: stuff';
      const migrated = '# Doc\n\nSome text[@1] here.\n\n<!-- mdview:annotations [{"id":1}] -->';
      vi.mocked(fs.readFileSync).mockReturnValue(existing);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const result = handleMessage({
        action: 'write',
        path: '/path/to/file.md',
        content: migrated,
      });

      expect(result).toEqual({ success: true });
    });

    it('should reject body-only changes', () => {
      const existing = '# Doc\n\nOriginal text here.';
      const modified = '# Doc\n\nModified text here.';
      vi.mocked(fs.readFileSync).mockReturnValue(existing);

      const result = handleMessage({
        action: 'write',
        path: '/path/to/file.md',
        content: modified,
      });

      expect((result as { error: string }).error).toContain('Refused');
    });

    it('should handle plain markdown with no annotations', () => {
      const existing = '# Doc\n\nSome text.';
      vi.mocked(fs.readFileSync).mockReturnValue(existing);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const result = handleMessage({
        action: 'write',
        path: '/path/to/file.md',
        content: existing,
      });

      expect(result).toEqual({ success: true });
    });

    it('should handle mixed v1 existing with v2 new markers', () => {
      const existing = '# Doc\n\nSome text[^comment-1] here.\n\n<!-- mdview:comments -->\nstuff';
      const updated = '# Doc\n\nSome text[@1] here.\n\n<!-- mdview:annotations [{"id":1}] -->';
      vi.mocked(fs.readFileSync).mockReturnValue(existing);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const result = handleMessage({
        action: 'write',
        path: '/path/to/file.md',
        content: updated,
      });

      expect(result).toEqual({ success: true });
    });

    it('should accept comment writes when file has CRLF line endings but content uses LF', () => {
      const existingCRLF = '# Doc\r\n\r\nSome text here.\r\n';
      const newContentLF =
        '# Doc\n\nSome text[@1] here.\n\n<!-- mdreview:annotations\n[{"id":"comment-1"}]\n-->';
      vi.mocked(fs.readFileSync).mockReturnValue(existingCRLF);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const result = handleMessage({
        action: 'write',
        path: '/path/to/file.md',
        content: newContentLF,
      });

      expect(result).toEqual({ success: true });
    });

    it('should accept comment writes when both use CRLF line endings', () => {
      const existingCRLF = '# Doc\r\n\r\nSome text here.\r\n';
      const newContentCRLF =
        '# Doc\r\n\r\nSome text[@1] here.\r\n\r\n<!-- mdreview:annotations\r\n[{"id":"comment-1"}]\r\n-->';
      vi.mocked(fs.readFileSync).mockReturnValue(existingCRLF);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const result = handleMessage({
        action: 'write',
        path: '/path/to/file.md',
        content: newContentCRLF,
      });

      expect(result).toEqual({ success: true });
    });

    it('should still reject body changes even with mixed line endings', () => {
      const existingCRLF = '# Doc\r\n\r\nOriginal text.\r\n';
      const modifiedLF = '# Doc\n\nModified text.\n';
      vi.mocked(fs.readFileSync).mockReturnValue(existingCRLF);

      const result = handleMessage({
        action: 'write',
        path: '/path/to/file.md',
        content: modifiedLF,
      });

      expect((result as { error: string }).error).toContain('Refused');
    });

    it('should return system username for get_username action', () => {
      vi.mocked(os.userInfo).mockReturnValue({
        username: 'testuser',
        uid: 1000,
        gid: 1000,
        shell: '/bin/bash',
        homedir: '/home/testuser',
      });

      const result = handleMessage({ action: 'get_username' });

      expect(result).toEqual({ success: true, username: 'testuser' });
    });

    it('should return error when os.userInfo() throws', () => {
      vi.mocked(os.userInfo).mockImplementation(() => {
        throw new Error('uv_os_get_passwd failed');
      });

      const result = handleMessage({ action: 'get_username' });

      expect(result).toEqual({ error: 'uv_os_get_passwd failed' });
    });
  });
});

/**
 * Tests for Native Messaging Host message handling logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { validatePath, handleMessage, ALLOWED_EXTENSIONS } from '../../../src/native-host/host-logic';

vi.mock('fs');

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
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
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
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const result = handleMessage({
        action: 'write',
        path: '/docs/page.mdx',
        content: 'import { Component } from "react"',
      });

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/docs/page.mdx',
        'import { Component } from "react"',
        'utf8',
      );
      expect(result).toEqual({ success: true });
    });
  });
});

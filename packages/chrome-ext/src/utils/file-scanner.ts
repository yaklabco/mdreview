/**
 * Re-export shim: delegates to @mdview/core FileScanner and adds
 * Chrome extension-specific methods (window.location, chrome.runtime).
 */

import { FileScanner as CoreFileScanner } from '@mdview/core';
import type { FileAdapter, FileChangeInfo } from '@mdview/core';
import { debug } from './debug-logger';

/**
 * Browser-aware FileScanner that extends core with Chrome-specific functionality.
 *
 * Pure utility methods (hasMarkdownExtension, generateHash, validateFileSize,
 * formatFileSize, getFileSize) are inherited from the core class.
 *
 * Browser-specific methods (isSiteBlocked, isMarkdownFile, getCurrentSiteIdentifier,
 * getFilePath, readFileContent, watchFile) are defined here.
 */
export class FileScanner extends CoreFileScanner {
  private static readonly MARKDOWN_MIME_TYPES_BROWSER = ['text/markdown', 'text/x-markdown'];

  /**
   * Check if the current site is in the blocklist.
   * Uses window.location for URL detection (Chrome extension only).
   */
  static isSiteBlocked(blocklist: string[]): boolean {
    if (!blocklist || blocklist.length === 0) {
      return false;
    }

    const url = window.location.href;
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    return this.isSiteBlockedFromList(blocklist, url, hostname, pathname);
  }

  /**
   * Get the current site identifier for display (hostname or file path).
   */
  static getCurrentSiteIdentifier(): string {
    const url = window.location.href;

    if (url.startsWith('file://')) {
      // For local files, show a truncated path
      const path = window.location.pathname;
      const parts = path.split('/');
      if (parts.length > 3) {
        return '.../' + parts.slice(-2).join('/');
      }
      return path;
    }

    // For web, show hostname
    return window.location.hostname;
  }

  /**
   * Check if the current page is a markdown file
   */
  static isMarkdownFile(): boolean {
    const url = window.location.href;
    const pathname = window.location.pathname;

    // Check protocol
    const isLocal = url.startsWith('file://');
    const isWeb = url.startsWith('http://') || url.startsWith('https://');

    if (!isLocal && !isWeb) {
      return false;
    }

    // Check by MIME type first if available (authoritative for web)
    const contentType = document.contentType;
    if (contentType && this.MARKDOWN_MIME_TYPES_BROWSER.includes(contentType)) {
      return true;
    }

    // For web, if content type is explicitly HTML, do not activate
    // (prevents rendering on GitHub UI pages which end in .md)
    if (isWeb && (contentType === 'text/html' || contentType === 'application/xhtml+xml')) {
      return false;
    }

    // Check by extension
    if (this.hasMarkdownExtension(pathname)) {
      return true;
    }

    return false;
  }

  /**
   * Get the current file path
   */
  static getFilePath(): string {
    return window.location.pathname;
  }

  /**
   * Read file content from the page or source.
   * For file:// URLs, Chrome displays the content in a <pre> tag initially.
   */
  static readFileContent(forceFetch = false): string {
    // For file:// URLs, Chrome displays the content in a <pre> tag
    // Initial load check
    if (!forceFetch) {
      const pre = document.querySelector('pre');
      if (pre) {
        return pre.textContent || '';
      }
      // If body is not cleared yet
      if (!document.getElementById('mdview-container')) {
        return document.body.textContent || '';
      }
    }

    return document.body.textContent || '';
  }

  /**
   * Monitor file changes using polling via background script delegation.
   * This preserves the original Chrome extension signature while delegating
   * to the core FileScanner with a Chrome FileAdapter.
   */
  static watchFile(initialHash: string, callback: () => void, interval = 1000): () => void {
    const fileUrl = window.location.href;

    debug.info('FileScanner', `Starting background-delegated file watcher for ${fileUrl}`);

    // Create a Chrome-specific file adapter that wraps chrome.runtime.sendMessage
    // and also handles extension context invalidation errors
    const chromeAdapter: FileAdapter = {
      writeFile() {
        return Promise.resolve({ success: false, error: 'Not supported via Chrome messaging' });
      },
      readFile() {
        return Promise.reject(new Error('Not supported via Chrome messaging'));
      },
      async checkChanged(url: string, lastHash: string): Promise<FileChangeInfo> {
        try {
          const response: unknown = await chrome.runtime.sendMessage({
            type: 'CHECK_FILE_CHANGED',
            payload: { url, lastHash },
          });
          const typed = response as {
            error?: string;
            changed?: boolean;
            newHash?: string;
          };
          return {
            changed: typed.changed ?? false,
            newHash: typed.newHash,
            error: typed.error,
          };
        } catch (error) {
          // Handle extension context invalidation
          const errorStr = String(error).toLowerCase();
          const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';

          const isContextInvalid =
            errorStr.includes('context invalidated') ||
            errorStr.includes('extension context') ||
            errorMessage.includes('context invalidated');

          if (isContextInvalid) {
            debug.warn('FileScanner', 'Extension context invalidated.');
          } else {
            debug.error('FileScanner', 'Error communicating with background:', error);
          }

          throw error;
        }
      },
      watch() {
        return () => {};
      },
    };

    return CoreFileScanner.watchFile(fileUrl, initialHash, callback, {
      fileAdapter: chromeAdapter,
      interval,
    });
  }
}

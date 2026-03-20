/**
 * File Scanner Utility (platform-independent)
 * Detects and validates markdown files by extension and MIME type.
 *
 * This is the core version: it has NO Chrome or browser-specific imports.
 * File-change watching uses an optional FileAdapter for cross-platform support.
 */

import type { FileAdapter } from '../adapters';

// Lightweight debug facade — no Chrome dependency
const debug = {
  log: (..._args: unknown[]) => {},
  info: (..._args: unknown[]) => {},
  warn: (..._args: unknown[]) => {},
  error: (..._args: unknown[]) => {},
  debug: (..._args: unknown[]) => {},
};

/** Options for the watchFile polling loop */
export interface WatchFileOptions {
  /** File adapter for checking changes. If omitted, watching is a no-op. */
  fileAdapter?: FileAdapter;
  /** Polling interval in ms (default: 1000) */
  interval?: number;
}

export class FileScanner {
  private static readonly MARKDOWN_EXTENSIONS = ['.md', '.markdown'];
  private static readonly MARKDOWN_MIME_TYPES = ['text/markdown', 'text/x-markdown'];

  // ---------------------------------------------------------------------------
  // Blocklist helpers (platform-independent — callers pass URL parts)
  // ---------------------------------------------------------------------------

  /**
   * Check if a site is blocked given explicit URL components.
   * This avoids direct `window.location` access so the method works anywhere.
   */
  static isSiteBlockedFromList(
    blocklist: string[],
    url: string,
    hostname: string,
    pathname: string
  ): boolean {
    if (!blocklist || blocklist.length === 0) {
      return false;
    }

    for (const pattern of blocklist) {
      if (this.matchesBlocklistPattern(pattern, url, hostname, pathname)) {
        debug.info('FileScanner', `Site blocked by pattern: ${pattern}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Match a URL against a blocklist pattern.
   * Pattern formats:
   * - "example.com"              — matches hostname exactly
   * - "*.example.com"            — matches any subdomain of example.com
   * - "example.com/path/*"       — matches hostname + path pattern
   * - "https://example.com/*"    — matches full URL pattern
   */
  static matchesBlocklistPattern(
    pattern: string,
    url: string,
    hostname: string,
    pathname: string
  ): boolean {
    // Normalize pattern (trim whitespace)
    pattern = pattern.trim().toLowerCase();

    if (!pattern) {
      return false;
    }

    // Full URL pattern (starts with http:// or https://)
    if (pattern.startsWith('http://') || pattern.startsWith('https://')) {
      return this.matchesGlobPattern(pattern, url.toLowerCase());
    }

    // Check if pattern includes a path
    const slashIndex = pattern.indexOf('/');
    if (slashIndex > 0) {
      // Pattern has path component: "example.com/path/*"
      const patternHost = pattern.substring(0, slashIndex);
      const patternPath = pattern.substring(slashIndex);

      if (!this.matchesHostPattern(patternHost, hostname.toLowerCase())) {
        return false;
      }

      return this.matchesGlobPattern(patternPath, pathname.toLowerCase());
    }

    // Domain-only pattern
    return this.matchesHostPattern(pattern, hostname.toLowerCase());
  }

  /**
   * Match hostname against a host pattern.
   * Supports wildcard subdomain: "*.example.com"
   */
  private static matchesHostPattern(pattern: string, hostname: string): boolean {
    // Exact match
    if (pattern === hostname) {
      return true;
    }

    // Wildcard subdomain: "*.example.com"
    if (pattern.startsWith('*.')) {
      const baseDomain = pattern.substring(2); // Remove "*."
      // Match the base domain itself or any subdomain
      return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
    }

    return false;
  }

  /**
   * Match a string against a glob pattern with * wildcards.
   * * matches any sequence of characters (including empty).
   */
  private static matchesGlobPattern(pattern: string, str: string): boolean {
    // Convert glob pattern to regex
    // Escape regex special chars except *, then convert * to .*
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*/g, '.*'); // Convert * to .*

    const regex = new RegExp('^' + regexPattern + '$');
    return regex.test(str);
  }

  // ---------------------------------------------------------------------------
  // Extension / MIME detection
  // ---------------------------------------------------------------------------

  /**
   * Check if a path has a markdown extension
   */
  static hasMarkdownExtension(path: string): boolean {
    const lowerPath = path.toLowerCase();
    return this.MARKDOWN_EXTENSIONS.some((ext) => lowerPath.endsWith(ext));
  }

  /**
   * Check if a MIME type is a markdown type
   */
  static isMarkdownMimeType(mimeType: string): boolean {
    return this.MARKDOWN_MIME_TYPES.includes(mimeType);
  }

  // ---------------------------------------------------------------------------
  // Hash / size utilities
  // ---------------------------------------------------------------------------

  /**
   * Generate SHA-256 hash for content comparison
   */
  static async generateHash(content: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate file size
   */
  static validateFileSize(content: string, maxSize = 10 * 1024 * 1024): boolean {
    const size = new Blob([content]).size;
    return size <= maxSize;
  }

  /**
   * Get file size in bytes
   */
  static getFileSize(content: string): number {
    return new Blob([content]).size;
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ---------------------------------------------------------------------------
  // File watching via FileAdapter (no chrome.* dependency)
  // ---------------------------------------------------------------------------

  /**
   * Monitor file changes by polling via a FileAdapter.
   * If no adapter is provided, returns a no-op cleanup function
   * (graceful degradation — file watching simply does not happen).
   */
  static watchFile(
    fileUrl: string,
    initialHash: string,
    callback: () => void,
    options: WatchFileOptions
  ): () => void {
    const { fileAdapter, interval = 1000 } = options;

    // Graceful degradation: no adapter means no watching
    if (!fileAdapter) {
      debug.info('FileScanner', 'No file adapter provided — file watching disabled');
      return () => {};
    }

    let lastHash = initialHash;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    debug.info('FileScanner', `Starting file watcher for ${fileUrl}`);

    const checkForChanges = () => {
      void (async () => {
        try {
          debug.log('FileScanner', 'Checking for file changes via adapter...');

          const result = await fileAdapter.checkChanged(fileUrl, lastHash);

          if (result.error) {
            debug.warn('FileScanner', 'Adapter check error:', result.error);
            return;
          }

          if (result.changed) {
            debug.info('FileScanner', 'File change detected (hash mismatch)');
            if (result.newHash) {
              lastHash = result.newHash;
            }
            callback();
          } else {
            debug.log('FileScanner', 'No change detected');
          }
        } catch (error) {
          debug.error('FileScanner', 'Error checking for file changes:', error);
        }
      })();
    };

    // Start polling
    intervalId = setInterval(checkForChanges, interval);

    // Return cleanup function
    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }
}

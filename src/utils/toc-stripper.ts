/**
 * Re-export shim: delegates to @mdview/core and injects the Chrome extension logger.
 */
export type { TocStripResult, TocStripperLogger } from '../../packages/core/src/utils/toc-stripper';

import { stripTableOfContents as coreStripTableOfContents } from '../../packages/core/src/utils/toc-stripper';
import { debug } from './debug-logger';

/**
 * Strip Table of Contents sections from markdown.
 * This wrapper injects the extension's debug logger into the core implementation.
 */
export function stripTableOfContents(markdown: string) {
  return coreStripTableOfContents(markdown, debug);
}

/**
 * Comment Manager — Chrome extension shim
 *
 * Re-exports the core CommentManager from @mdview/core, pre-configured
 * with Chrome extension adapters that delegate to chrome.runtime.sendMessage
 * for file writes (WRITE_FILE) and username lookup (GET_USERNAME).
 *
 * This shim will be removed once the extension is fully migrated to core.
 */

import { CommentManager as CoreCommentManager, type CommentManagerAdapters } from '@mdview/core';
import { ChromeFileAdapter, ChromeIdentityAdapter } from '../adapters';

/**
 * CommentManager pre-configured with Chrome extension adapters.
 * Drop-in replacement for the previous monolithic CommentManager.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class CommentManager extends CoreCommentManager {
  constructor(adapters?: CommentManagerAdapters) {
    // If no adapters provided, use Chrome-backed defaults
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const resolved: CommentManagerAdapters = adapters ?? {
      file: new ChromeFileAdapter(),
      identity: new ChromeIdentityAdapter(),
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super(resolved);
  }
}

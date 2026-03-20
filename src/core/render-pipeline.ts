/**
 * Render Pipeline (Chrome Extension Shim)
 *
 * Re-exports the platform-agnostic RenderPipeline from @mdview/core,
 * pre-configured with a Chrome MessagingAdapter that delegates
 * to chrome.runtime.sendMessage.
 */

import {
  RenderPipeline as CoreRenderPipeline,
  type RenderOptions,
  type RenderProgress,
  type ProgressCallback,
  type RenderPipelineOptions,
} from '../../packages/core/src/render-pipeline';
import type { MessagingAdapter, IPCMessage } from '../../packages/core/src/adapters';

// ---------------------------------------------------------------------------
// Chrome MessagingAdapter — bridges core pipeline to chrome.runtime
// ---------------------------------------------------------------------------

class ChromeMessagingAdapter implements MessagingAdapter {
  async send(message: IPCMessage): Promise<unknown> {
    return chrome.runtime.sendMessage(message);
  }
}

// ---------------------------------------------------------------------------
// Re-export the pipeline class (consumers can still `new RenderPipeline()`)
// ---------------------------------------------------------------------------

/**
 * Chrome-flavored RenderPipeline.
 *
 * Extends the core pipeline by injecting a ChromeMessagingAdapter so that
 * cache operations (CACHE_GENERATE_KEY, CACHE_GET, CACHE_SET) are routed
 * through the Chrome extension service worker.
 */
export class RenderPipeline extends CoreRenderPipeline {
  constructor(options?: RenderPipelineOptions) {
    super({
      messaging: new ChromeMessagingAdapter(),
      ...options,
    });
  }
}

// Re-export types so existing consumers keep working
export type { RenderOptions, RenderProgress, ProgressCallback };

// Export singleton
export const renderPipeline = new RenderPipeline();

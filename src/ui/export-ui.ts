// Re-export shim: export-ui has moved to @mdview/core
// This shim provides Chrome extension MessagingAdapter and platform-specific factories.
// It will be removed in Phase 2.9

import type { ExportUIOptions } from '../types';
import type { MessagingAdapter, IPCMessage } from '../../packages/core/src/adapters';
import {
  ExportUI as CoreExportUI,
  type CoreExportUIOptions,
} from '../../packages/core/src/ui/export-ui';

/** Chrome extension MessagingAdapter using chrome.runtime.sendMessage */
class ChromeMessagingAdapter implements MessagingAdapter {
  async send(message: IPCMessage): Promise<unknown> {
    return chrome.runtime.sendMessage(message);
  }
}

/**
 * ExportUI wrapper that injects Chrome-specific dependencies.
 *
 * Maintains the same constructor signature as the original so that
 * existing call-sites (e.g. content-script.ts) continue to work
 * without modification.
 */
export class ExportUI extends CoreExportUI {
  constructor(options?: ExportUIOptions) {
    const coreOptions: CoreExportUIOptions = {
      ...options,
      messaging: new ChromeMessagingAdapter(),
      factories: {
        createExportController: async () => {
          const { ExportController } = await import('../core/export-controller');
          return new ExportController();
        },
        createPDFGenerator: async () => {
          const { PDFGenerator } = await import('../utils/pdf-generator');
          return new PDFGenerator();
        },
      },
    };
    super(coreOptions);
  }
}

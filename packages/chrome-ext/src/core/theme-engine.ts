/**
 * Theme Engine — Chrome extension shim
 *
 * Re-exports the core ThemeEngine pre-configured with a Chrome StorageAdapter.
 * All DOM operations (applyTheme, watchSystemTheme) are handled by the core engine.
 */

import { ThemeEngine as CoreThemeEngine } from '@mdreview/core';
import { ChromeStorageAdapter } from '../adapters';

export type { ThemeInfo } from '@mdreview/core';

export class ThemeEngine extends CoreThemeEngine {
  constructor() {
    super(new ChromeStorageAdapter());
  }
}

// Export singleton
export const themeEngine = new ThemeEngine();

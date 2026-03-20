import type { AppState, Preferences } from '@mdview/core';
import { DEFAULT_STATE } from '@mdview/core';
import type { StorageAdapter } from '@mdview/core';

export class StateManager {
  private state: AppState = structuredClone(DEFAULT_STATE);

  constructor(private storage: StorageAdapter) {}

  async initialize(): Promise<void> {
    const syncData = await this.storage.getSync('preferences');
    const storedPrefs: unknown = syncData['preferences'];
    if (storedPrefs && typeof storedPrefs === 'object') {
      Object.assign(this.state.preferences, storedPrefs);
    }

    const localData = await this.storage.getLocal(['ui', 'document']);
    const storedUI: unknown = localData['ui'];
    if (storedUI && typeof storedUI === 'object') {
      Object.assign(this.state.ui, storedUI);
    }
    const storedDoc: unknown = localData['document'];
    if (storedDoc && typeof storedDoc === 'object') {
      Object.assign(this.state.document, storedDoc);
    }
  }

  getState(): AppState {
    return { ...this.state };
  }

  async updatePreferences(prefs: Partial<Preferences>): Promise<void> {
    Object.assign(this.state.preferences, prefs);
    await this.storage.setSync({ preferences: this.state.preferences });
  }

  getPreferences(): AppState['preferences'] {
    return { ...this.state.preferences };
  }
}

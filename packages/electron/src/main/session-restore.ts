import type ElectronStore from 'electron-store';
import { existsSync } from 'fs';

const STORE_KEY = 'session';

export interface SessionData {
  tabs: string[];
  activeIndex: number;
}

export class SessionManager {
  constructor(
    private store: ElectronStore,
    private fileExists: (path: string) => boolean = existsSync
  ) {}

  saveSession(data: SessionData): void {
    this.store.set(STORE_KEY, data);
  }

  getLastSession(): SessionData | null {
    const raw: unknown = this.store.get(STORE_KEY);
    if (!raw || typeof raw !== 'object') return null;

    const data = raw as Record<string, unknown>;
    if (!Array.isArray(data.tabs) || typeof data.activeIndex !== 'number') {
      return null;
    }

    const tabs = (data.tabs as string[]).filter((p) => this.fileExists(p));
    if (tabs.length === 0) return null;

    const activeIndex = Math.min(data.activeIndex, tabs.length - 1);

    return { tabs, activeIndex };
  }

  clearSession(): void {
    this.store.delete(STORE_KEY);
  }
}

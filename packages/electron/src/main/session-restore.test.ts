import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from './session-restore';

function createMockStore() {
  const data = new Map<string, unknown>();
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => data.get(key) ?? defaultValue),
    set: vi.fn((key: string, value: unknown) => data.set(key, value)),
    delete: vi.fn((key: string) => data.delete(key)),
    _data: data,
  };
}

describe('SessionManager', () => {
  let store: ReturnType<typeof createMockStore>;
  let fileExists: ReturnType<typeof vi.fn>;
  let manager: SessionManager;

  beforeEach(() => {
    store = createMockStore();
    fileExists = vi.fn().mockReturnValue(true);
    manager = new SessionManager(store as never, fileExists);
  });

  it('should save session with tab file paths and active tab', () => {
    manager.saveSession({
      tabs: ['/tmp/a.md', '/tmp/b.md'],
      activeIndex: 1,
    });
    expect(store.set).toHaveBeenCalledWith('session', {
      tabs: ['/tmp/a.md', '/tmp/b.md'],
      activeIndex: 1,
    });
  });

  it('should restore session and filter nonexistent files', () => {
    store._data.set('session', {
      tabs: ['/tmp/exists.md', '/tmp/gone.md'],
      activeIndex: 0,
    });
    fileExists.mockImplementation((p: string) => p !== '/tmp/gone.md');

    const session = manager.getLastSession();
    expect(session).not.toBeNull();
    expect(session?.tabs).toEqual(['/tmp/exists.md']);
    expect(session?.activeIndex).toBe(0);
  });

  it('should return null when no session saved', () => {
    expect(manager.getLastSession()).toBeNull();
  });

  it('should clear session', () => {
    store._data.set('session', { tabs: ['/tmp/a.md'], activeIndex: 0 });
    manager.clearSession();
    expect(store.delete).toHaveBeenCalledWith('session');
  });

  it('should handle corrupt session data gracefully', () => {
    store._data.set('session', 'not an object');
    expect(manager.getLastSession()).toBeNull();
  });

  it('should clamp activeIndex when files are filtered out', () => {
    store._data.set('session', {
      tabs: ['/tmp/gone1.md', '/tmp/gone2.md', '/tmp/exists.md'],
      activeIndex: 2,
    });
    fileExists.mockImplementation((p: string) => p === '/tmp/exists.md');

    const session = manager.getLastSession();
    expect(session?.tabs).toEqual(['/tmp/exists.md']);
    expect(session?.activeIndex).toBe(0);
  });
});

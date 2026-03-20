import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerKeyboardShortcuts, KeyboardShortcutHandlers } from './keyboard-shortcuts';

describe('registerKeyboardShortcuts', () => {
  let handlers: KeyboardShortcutHandlers;
  let cleanup: () => void;

  beforeEach(() => {
    handlers = {
      nextTab: vi.fn(),
      prevTab: vi.fn(),
      switchToTab: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup?.();
  });

  function dispatchKey(options: KeyboardEventInit) {
    document.dispatchEvent(new KeyboardEvent('keydown', options));
  }

  it('should call nextTab on Ctrl/Cmd+Tab', () => {
    cleanup = registerKeyboardShortcuts(handlers);

    dispatchKey({ key: 'Tab', ctrlKey: true });
    expect(handlers.nextTab).toHaveBeenCalledTimes(1);

    dispatchKey({ key: 'Tab', metaKey: true });
    expect(handlers.nextTab).toHaveBeenCalledTimes(2);
  });

  it('should call prevTab on Ctrl/Cmd+Shift+Tab', () => {
    cleanup = registerKeyboardShortcuts(handlers);

    dispatchKey({ key: 'Tab', ctrlKey: true, shiftKey: true });
    expect(handlers.prevTab).toHaveBeenCalledTimes(1);

    dispatchKey({ key: 'Tab', metaKey: true, shiftKey: true });
    expect(handlers.prevTab).toHaveBeenCalledTimes(2);
  });

  it('should call switchToTab with index for Ctrl/Cmd+1 through Ctrl/Cmd+9', () => {
    cleanup = registerKeyboardShortcuts(handlers);

    for (let digit = 1; digit <= 9; digit++) {
      dispatchKey({ key: String(digit), ctrlKey: true });
    }

    expect(handlers.switchToTab).toHaveBeenCalledTimes(9);
    for (let digit = 1; digit <= 9; digit++) {
      expect(handlers.switchToTab).toHaveBeenCalledWith(digit - 1);
    }

    // Also test with metaKey
    (handlers.switchToTab as ReturnType<typeof vi.fn>).mockClear();
    dispatchKey({ key: '3', metaKey: true });
    expect(handlers.switchToTab).toHaveBeenCalledWith(2);
  });

  it('should return a cleanup function that removes event listeners', () => {
    cleanup = registerKeyboardShortcuts(handlers);

    dispatchKey({ key: 'Tab', ctrlKey: true });
    expect(handlers.nextTab).toHaveBeenCalledTimes(1);

    cleanup();

    dispatchKey({ key: 'Tab', ctrlKey: true });
    expect(handlers.nextTab).toHaveBeenCalledTimes(1); // no additional call
  });

  it('should not trigger on unrelated key combos', () => {
    cleanup = registerKeyboardShortcuts(handlers);

    // Plain Tab without modifier
    dispatchKey({ key: 'Tab' });
    // Ctrl+A
    dispatchKey({ key: 'a', ctrlKey: true });
    // Ctrl+0 (not in 1-9 range)
    dispatchKey({ key: '0', ctrlKey: true });
    // Shift+1 without Ctrl/Cmd
    dispatchKey({ key: '1', shiftKey: true });

    expect(handlers.nextTab).not.toHaveBeenCalled();
    expect(handlers.prevTab).not.toHaveBeenCalled();
    expect(handlers.switchToTab).not.toHaveBeenCalled();
  });

  it('should call openPreferences on Cmd/Ctrl+,', () => {
    const handlersWithPrefs = {
      ...handlers,
      openPreferences: vi.fn(),
    };
    cleanup = registerKeyboardShortcuts(handlersWithPrefs);

    dispatchKey({ key: ',', metaKey: true });
    expect(handlersWithPrefs.openPreferences).toHaveBeenCalledTimes(1);

    dispatchKey({ key: ',', ctrlKey: true });
    expect(handlersWithPrefs.openPreferences).toHaveBeenCalledTimes(2);
  });

  it('should not throw when openPreferences is undefined and Cmd+, pressed', () => {
    cleanup = registerKeyboardShortcuts(handlers);
    expect(() => dispatchKey({ key: ',', metaKey: true })).not.toThrow();
  });

  it('should handle case when handler is undefined', () => {
    const partial = {
      nextTab: undefined as unknown as () => void,
      prevTab: vi.fn(),
      switchToTab: undefined as unknown as (index: number) => void,
    };
    cleanup = registerKeyboardShortcuts(partial);

    // These should not throw even though handlers are undefined
    expect(() => dispatchKey({ key: 'Tab', ctrlKey: true })).not.toThrow();
    expect(() => dispatchKey({ key: '1', ctrlKey: true })).not.toThrow();

    // The defined handler should still work
    dispatchKey({ key: 'Tab', ctrlKey: true, shiftKey: true });
    expect(partial.prevTab).toHaveBeenCalledTimes(1);
  });
});

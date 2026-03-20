export interface KeyboardShortcutHandlers {
  nextTab: () => void;
  prevTab: () => void;
  switchToTab: (index: number) => void;
}

export function registerKeyboardShortcuts(handlers: KeyboardShortcutHandlers): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const modifier = e.metaKey || e.ctrlKey;
    if (!modifier) return;

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        handlers.prevTab?.();
      } else {
        handlers.nextTab?.();
      }
      e.preventDefault();
      return;
    }

    const digit = parseInt(e.key, 10);
    if (digit >= 1 && digit <= 9 && !e.shiftKey && !e.altKey) {
      handlers.switchToTab?.(digit - 1);
      e.preventDefault();
    }
  };

  document.addEventListener('keydown', onKeyDown);

  return () => {
    document.removeEventListener('keydown', onKeyDown);
  };
}

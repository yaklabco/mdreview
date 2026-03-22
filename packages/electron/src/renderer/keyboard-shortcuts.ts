export interface KeyboardShortcutHandlers {
  nextTab: () => void;
  prevTab: () => void;
  switchToTab: (index: number) => void;
  openPreferences?: () => void;
  openExportModal?: () => void;
  toggleTabBar?: () => void;
  toggleHeaderBar?: () => void;
  toggleToc?: () => void;
}

export function registerKeyboardShortcuts(handlers: KeyboardShortcutHandlers): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const modifier = e.metaKey || e.ctrlKey;
    if (!modifier) return;

    if (e.key === ',' && !e.shiftKey && !e.altKey) {
      handlers.openPreferences?.();
      e.preventDefault();
      return;
    }

    if (e.key === 'e' && !e.shiftKey && !e.altKey) {
      handlers.openExportModal?.();
      e.preventDefault();
      return;
    }

    // Cmd/Ctrl+Shift shortcuts for panel toggles
    if (e.shiftKey && !e.altKey) {
      const lower = e.key.toLowerCase();
      if (lower === 'b') {
        handlers.toggleTabBar?.();
        e.preventDefault();
        return;
      }
      if (lower === 'h') {
        handlers.toggleHeaderBar?.();
        e.preventDefault();
        return;
      }
      if (lower === 't') {
        handlers.toggleToc?.();
        e.preventDefault();
        return;
      }
    }

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

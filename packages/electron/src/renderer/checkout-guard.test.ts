import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CheckoutGuard } from './checkout-guard';

describe('CheckoutGuard', () => {
  let guard: CheckoutGuard;

  beforeEach(() => {
    document.body.innerHTML = '';
    guard = new CheckoutGuard();
  });

  afterEach(() => {
    guard.dismiss();
    document.body.innerHTML = '';
  });

  function showWithDefaults(overrides = {}) {
    const defaults = {
      targetBranch: 'develop',
      dirtyFileCount: 3,
      onCommitFirst: vi.fn(),
      onStash: vi.fn(),
      onDiscard: vi.fn(),
      onCancel: vi.fn(),
      ...overrides,
    };
    guard.show(defaults);
    return defaults;
  }

  it('shows modal with dirty file count and branch name', () => {
    showWithDefaults({ dirtyFileCount: 5, targetBranch: 'feature-x' });

    const overlay = document.querySelector('.checkout-guard-overlay');
    expect(overlay).not.toBeNull();

    const dialog = document.querySelector('.checkout-guard-dialog');
    expect(dialog).not.toBeNull();

    const title = document.querySelector('.checkout-guard-title');
    expect(title?.textContent).toBe('Unsaved Changes');

    const message = document.querySelector('.checkout-guard-message');
    expect(message?.textContent).toContain('5 changed files');
    expect(message?.textContent).toContain('feature-x');
  });

  it('shows singular form for 1 file', () => {
    showWithDefaults({ dirtyFileCount: 1 });
    const message = document.querySelector('.checkout-guard-message');
    expect(message?.textContent).toContain('1 changed file.');
  });

  it('fires onCommitFirst callback', () => {
    const opts = showWithDefaults();
    const commitBtn = document.querySelector('.checkout-guard-btn.primary') as HTMLElement;
    expect(commitBtn.textContent).toBe('Commit First');
    commitBtn.click();

    expect(opts.onCommitFirst).toHaveBeenCalled();
    expect(document.querySelector('.checkout-guard-overlay')).toBeNull();
  });

  it('fires onStash callback', () => {
    const opts = showWithDefaults();
    const buttons = document.querySelectorAll('.checkout-guard-btn');
    const stashBtn = Array.from(buttons).find(
      (b) => b.textContent === 'Stash Changes'
    ) as HTMLElement;
    stashBtn.click();

    expect(opts.onStash).toHaveBeenCalled();
    expect(document.querySelector('.checkout-guard-overlay')).toBeNull();
  });

  it('discard shows secondary confirmation', () => {
    showWithDefaults();
    const discardBtn = document.querySelector('.checkout-guard-btn.destructive') as HTMLElement;
    expect(discardBtn.textContent).toBe('Discard Changes');
    discardBtn.click();

    const confirmText = document.querySelector('.checkout-guard-confirm-text');
    expect(confirmText?.textContent).toContain('Are you sure?');
    expect(confirmText?.textContent).toContain('cannot be undone');
  });

  it('fires onDiscard after confirmation', () => {
    const opts = showWithDefaults();
    const discardBtn = document.querySelector('.checkout-guard-btn.destructive') as HTMLElement;
    discardBtn.click();

    // Now click confirm discard
    const confirmBtns = document.querySelectorAll(
      '.checkout-guard-confirm-actions .checkout-guard-btn'
    );
    const confirmDiscard = Array.from(confirmBtns).find(
      (b) => b.textContent === 'Confirm Discard'
    ) as HTMLElement;
    confirmDiscard.click();

    expect(opts.onDiscard).toHaveBeenCalled();
    expect(document.querySelector('.checkout-guard-overlay')).toBeNull();
  });

  it('back button in discard confirmation returns to original state', () => {
    showWithDefaults();
    const discardBtn = document.querySelector('.checkout-guard-btn.destructive') as HTMLElement;
    discardBtn.click();

    // Click back
    const confirmBtns = document.querySelectorAll(
      '.checkout-guard-confirm-actions .checkout-guard-btn'
    );
    const backBtn = Array.from(confirmBtns).find((b) => b.textContent === 'Back') as HTMLElement;
    backBtn.click();

    // Confirmation should be gone, discard button should be visible again
    expect(document.querySelector('.checkout-guard-confirm')).toBeNull();
    const restoredDiscard = document.querySelector(
      '.checkout-guard-btn.destructive'
    ) as HTMLElement;
    expect(restoredDiscard.style.display).not.toBe('none');
  });

  it('cancel dismisses modal', () => {
    const opts = showWithDefaults();
    const cancelBtn = document.querySelector('.checkout-guard-btn.cancel') as HTMLElement;
    cancelBtn.click();

    expect(opts.onCancel).toHaveBeenCalled();
    expect(document.querySelector('.checkout-guard-overlay')).toBeNull();
  });

  it('escape key dismisses modal', () => {
    const opts = showWithDefaults();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(opts.onCancel).toHaveBeenCalled();
    expect(document.querySelector('.checkout-guard-overlay')).toBeNull();
  });

  it('click outside dialog dismisses modal', () => {
    const opts = showWithDefaults();
    const overlay = document.querySelector('.checkout-guard-overlay') as HTMLElement;
    // Click on the overlay itself (not the dialog)
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(opts.onCancel).toHaveBeenCalled();
    expect(document.querySelector('.checkout-guard-overlay')).toBeNull();
  });

  it('dismiss() cleans up', () => {
    showWithDefaults();
    guard.dismiss();
    expect(document.querySelector('.checkout-guard-overlay')).toBeNull();
  });
});

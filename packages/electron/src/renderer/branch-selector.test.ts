import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BranchSelector } from './branch-selector';

describe('BranchSelector', () => {
  let selector: BranchSelector;
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="test-container"></div>';
    container = document.getElementById('test-container')!;
    selector = new BranchSelector();
    selector.render(container);
  });

  afterEach(() => {
    selector.dispose();
    document.body.innerHTML = '';
  });

  it('renders branch selector into container', () => {
    const el = container.querySelector('.branch-selector');
    expect(el).not.toBeNull();
  });

  it('is hidden when isGitRepo is false', () => {
    selector.update(false, '', []);
    const el = container.querySelector('.branch-selector') as HTMLElement;
    expect(el.style.display).toBe('none');
  });

  it('shows current branch name', () => {
    selector.update(true, 'main', ['main', 'develop']);
    const btn = container.querySelector('.branch-selector-btn');
    expect(btn?.textContent).toContain('main');
  });

  it('lists branches in dropdown on click', () => {
    selector.update(true, 'main', ['main', 'develop', 'feature/x']);
    const btn = container.querySelector('.branch-selector-btn') as HTMLElement;
    btn.click();

    const dropdown = document.querySelector('.branch-selector-dropdown');
    expect(dropdown).not.toBeNull();

    const items = dropdown!.querySelectorAll('.branch-selector-item');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain('main');
    expect(items[1].textContent).toContain('develop');
    expect(items[2].textContent).toContain('feature/x');
  });

  it('current branch has checkmark', () => {
    selector.update(true, 'main', ['main', 'develop']);
    const btn = container.querySelector('.branch-selector-btn') as HTMLElement;
    btn.click();

    const items = document.querySelectorAll('.branch-selector-item');
    const currentItem = items[0];
    expect(currentItem.classList.contains('current')).toBe(true);

    const checkmark = currentItem.querySelector('.branch-selector-checkmark');
    expect(checkmark?.textContent).toBe('\u2713');

    // Second item should not have checkmark text
    const otherCheckmark = items[1].querySelector('.branch-selector-checkmark');
    expect(otherCheckmark?.textContent).toBe('');
  });

  it('fires checkout callback on branch selection', () => {
    const callback = vi.fn();
    selector.onCheckout(callback);
    selector.update(true, 'main', ['main', 'develop']);

    const btn = container.querySelector('.branch-selector-btn') as HTMLElement;
    btn.click();

    const items = document.querySelectorAll('.branch-selector-item');
    (items[1] as HTMLElement).click(); // Click 'develop'

    expect(callback).toHaveBeenCalledWith('develop');
  });

  it('does not fire checkout callback when clicking current branch', () => {
    const callback = vi.fn();
    selector.onCheckout(callback);
    selector.update(true, 'main', ['main', 'develop']);

    const btn = container.querySelector('.branch-selector-btn') as HTMLElement;
    btn.click();

    const items = document.querySelectorAll('.branch-selector-item');
    (items[0] as HTMLElement).click(); // Click 'main' (current)

    expect(callback).not.toHaveBeenCalled();
  });

  it('dismisses dropdown on click outside', () => {
    vi.useFakeTimers();
    selector.update(true, 'main', ['main', 'develop']);

    const btn = container.querySelector('.branch-selector-btn') as HTMLElement;
    btn.click();

    expect(document.querySelector('.branch-selector-dropdown')).not.toBeNull();

    vi.runAllTimers();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.querySelector('.branch-selector-dropdown')).toBeNull();
    vi.useRealTimers();
  });

  it('toggles dropdown off when button clicked while open', () => {
    selector.update(true, 'main', ['main', 'develop']);

    const btn = container.querySelector('.branch-selector-btn') as HTMLElement;
    btn.click();
    expect(document.querySelector('.branch-selector-dropdown')).not.toBeNull();

    btn.click();
    expect(document.querySelector('.branch-selector-dropdown')).toBeNull();
  });

  it('dispose() cleans up', () => {
    selector.update(true, 'main', ['main', 'develop']);
    const btn = container.querySelector('.branch-selector-btn') as HTMLElement;
    btn.click();

    selector.dispose();

    expect(document.querySelector('.branch-selector-dropdown')).toBeNull();
    const el = container.querySelector('.branch-selector') as HTMLElement;
    expect(el.innerHTML).toBe('');
    expect(el.style.display).toBe('none');
  });
});

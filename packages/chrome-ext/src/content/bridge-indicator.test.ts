import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BridgeIndicator } from './bridge-indicator';

describe('BridgeIndicator', () => {
  let parent: HTMLElement;
  let indicator: BridgeIndicator;

  beforeEach(() => {
    vi.useFakeTimers();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    indicator = new BridgeIndicator();
  });

  afterEach(() => {
    indicator.dispose();
    parent.remove();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  it('renders shadow DOM host element into parent', () => {
    indicator.render(parent);

    const host = parent.querySelector('.bridge-indicator-host');
    expect(host).not.toBeNull();
    expect(host!.shadowRoot).not.toBeNull();
  });

  it('initial state is disconnected', () => {
    indicator.render(parent);

    const host = parent.querySelector('.bridge-indicator-host')!;
    const shadow = host.shadowRoot!;
    const pill = shadow.querySelector('.bridge-indicator')!;

    expect(pill.getAttribute('data-state')).toBe('disconnected');
  });

  // ---------------------------------------------------------------------------
  // Connected state
  // ---------------------------------------------------------------------------

  it('shows green dot and "Connected" label when state is connected', () => {
    indicator.render(parent);
    indicator.updateState('connected');

    const shadow = parent.querySelector('.bridge-indicator-host')!.shadowRoot!;
    const pill = shadow.querySelector('.bridge-indicator')!;
    const dot = shadow.querySelector('.bridge-dot') as HTMLElement;
    const label = shadow.querySelector('.bridge-label')!;

    expect(pill.getAttribute('data-state')).toBe('connected');
    expect(dot.style.backgroundColor).toBe('rgb(34, 197, 94)');
    expect(label.textContent).toBe('Connected');
  });

  it('fades to near-invisible after 3 seconds when connected', () => {
    indicator.render(parent);
    indicator.updateState('connected');

    const shadow = parent.querySelector('.bridge-indicator-host')!.shadowRoot!;
    const pill = shadow.querySelector('.bridge-indicator')!;

    // Before timeout: not faded
    expect(pill.classList.contains('faded')).toBe(false);

    // After 3 seconds
    vi.advanceTimersByTime(3000);

    expect(pill.classList.contains('faded')).toBe(true);
  });

  it('shows full opacity on hover when faded', () => {
    indicator.render(parent);
    indicator.updateState('connected');

    const shadow = parent.querySelector('.bridge-indicator-host')!.shadowRoot!;
    const pill = shadow.querySelector('.bridge-indicator')!;

    // Advance to faded state
    vi.advanceTimersByTime(3000);
    expect(pill.classList.contains('faded')).toBe(true);

    // The CSS handles hover via :hover pseudo-class. We verify the style
    // element contains the appropriate :hover rule.
    const style = shadow.querySelector('style')!;
    expect(style.textContent).toContain('.bridge-indicator.faded:hover');
    expect(style.textContent).toContain('opacity: 1');
  });

  // ---------------------------------------------------------------------------
  // Reconnecting state
  // ---------------------------------------------------------------------------

  it('shows amber pulsing dot and attempt count when reconnecting', () => {
    indicator.render(parent);
    indicator.updateState('reconnecting', 3);

    const shadow = parent.querySelector('.bridge-indicator-host')!.shadowRoot!;
    const pill = shadow.querySelector('.bridge-indicator')!;
    const dot = shadow.querySelector('.bridge-dot') as HTMLElement;
    const label = shadow.querySelector('.bridge-label')!;

    expect(pill.getAttribute('data-state')).toBe('reconnecting');
    expect(dot.style.backgroundColor).toBe('rgb(245, 158, 11)');
    expect(label.textContent).toBe('Reconnecting... (3)');

    // Verify the pulse animation is applied via CSS
    const style = shadow.querySelector('style')!;
    expect(style.textContent).toContain('@keyframes pulse');
  });

  it('does not fade when reconnecting', () => {
    indicator.render(parent);
    indicator.updateState('reconnecting', 1);

    const shadow = parent.querySelector('.bridge-indicator-host')!.shadowRoot!;
    const pill = shadow.querySelector('.bridge-indicator')!;

    // Advance well past the 3-second fade timeout
    vi.advanceTimersByTime(10000);

    expect(pill.classList.contains('faded')).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Disconnected state
  // ---------------------------------------------------------------------------

  it('shows red dot and "Bridge offline" when disconnected', () => {
    indicator.render(parent);
    // Indicator starts disconnected, but let's go through connected first
    indicator.updateState('connected');
    indicator.updateState('disconnected');

    const shadow = parent.querySelector('.bridge-indicator-host')!.shadowRoot!;
    const pill = shadow.querySelector('.bridge-indicator')!;
    const dot = shadow.querySelector('.bridge-dot') as HTMLElement;
    const label = shadow.querySelector('.bridge-label')!;

    expect(pill.getAttribute('data-state')).toBe('disconnected');
    expect(dot.style.backgroundColor).toBe('rgb(239, 68, 68)');
    expect(label.textContent).toBe('Bridge offline');
  });

  it('does not fade when disconnected', () => {
    indicator.render(parent);
    indicator.updateState('disconnected');

    const shadow = parent.querySelector('.bridge-indicator-host')!.shadowRoot!;
    const pill = shadow.querySelector('.bridge-indicator')!;

    vi.advanceTimersByTime(10000);

    expect(pill.classList.contains('faded')).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Click / retry behavior
  // ---------------------------------------------------------------------------

  it('clicking in disconnected state fires retry callback', () => {
    const retryFn = vi.fn();
    indicator.onRetry(retryFn);
    indicator.render(parent);
    indicator.updateState('disconnected');

    const shadow = parent.querySelector('.bridge-indicator-host')!.shadowRoot!;
    const pill = shadow.querySelector('.bridge-indicator')!;

    pill.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(retryFn).toHaveBeenCalledOnce();
  });

  it('clicking in connected state does NOT fire retry callback', () => {
    const retryFn = vi.fn();
    indicator.onRetry(retryFn);
    indicator.render(parent);
    indicator.updateState('connected');

    const shadow = parent.querySelector('.bridge-indicator-host')!.shadowRoot!;
    const pill = shadow.querySelector('.bridge-indicator')!;

    pill.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(retryFn).not.toHaveBeenCalled();
  });

  it('clicking in reconnecting state does NOT fire retry callback', () => {
    const retryFn = vi.fn();
    indicator.onRetry(retryFn);
    indicator.render(parent);
    indicator.updateState('reconnecting', 2);

    const shadow = parent.querySelector('.bridge-indicator-host')!.shadowRoot!;
    const pill = shadow.querySelector('.bridge-indicator')!;

    pill.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(retryFn).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // State transitions
  // ---------------------------------------------------------------------------

  it('updateState transitions between states correctly', () => {
    indicator.render(parent);

    const shadow = parent.querySelector('.bridge-indicator-host')!.shadowRoot!;
    const pill = shadow.querySelector('.bridge-indicator')!;

    // disconnected -> connected
    indicator.updateState('connected');
    expect(pill.getAttribute('data-state')).toBe('connected');

    // connected -> reconnecting
    indicator.updateState('reconnecting', 1);
    expect(pill.getAttribute('data-state')).toBe('reconnecting');

    // reconnecting -> disconnected
    indicator.updateState('disconnected');
    expect(pill.getAttribute('data-state')).toBe('disconnected');

    // disconnected -> reconnecting
    indicator.updateState('reconnecting', 2);
    expect(pill.getAttribute('data-state')).toBe('reconnecting');

    // reconnecting -> connected
    indicator.updateState('connected');
    expect(pill.getAttribute('data-state')).toBe('connected');
  });

  it('transitioning from connected clears the fade timeout', () => {
    indicator.render(parent);
    indicator.updateState('connected');

    const shadow = parent.querySelector('.bridge-indicator-host')!.shadowRoot!;
    const pill = shadow.querySelector('.bridge-indicator')!;

    // Before fade kicks in, switch to reconnecting
    vi.advanceTimersByTime(1000);
    indicator.updateState('reconnecting', 1);

    // Advance past original fade timeout
    vi.advanceTimersByTime(5000);

    // Should NOT be faded since we switched away from connected
    expect(pill.classList.contains('faded')).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Dispose
  // ---------------------------------------------------------------------------

  it('dispose() removes the host element and clears timers', () => {
    indicator.render(parent);
    indicator.updateState('connected');

    // Host element exists
    expect(parent.querySelector('.bridge-indicator-host')).not.toBeNull();

    indicator.dispose();

    // Host element removed
    expect(parent.querySelector('.bridge-indicator-host')).toBeNull();
  });

  it('dispose() is safe to call multiple times', () => {
    indicator.render(parent);

    expect(() => {
      indicator.dispose();
      indicator.dispose();
    }).not.toThrow();
  });

  it('dispose() is safe to call without render', () => {
    expect(() => {
      indicator.dispose();
    }).not.toThrow();
  });

  // ---------------------------------------------------------------------------
  // Cursor style
  // ---------------------------------------------------------------------------

  it('has pointer cursor when disconnected', () => {
    indicator.render(parent);
    indicator.updateState('disconnected');

    const shadow = parent.querySelector('.bridge-indicator-host')!.shadowRoot!;
    const style = shadow.querySelector('style')!;

    // Verify that disconnected state gets pointer cursor via CSS
    expect(style.textContent).toContain('cursor: pointer');
  });
});

/**
 * Bridge connection health indicator.
 *
 * A shadow DOM component that displays native host bridge health
 * as a floating pill in the bottom-right corner of the page.
 *
 * Three visual states:
 * - connected: green dot, fades after 3 s
 * - reconnecting: amber pulsing dot with attempt count
 * - disconnected: red dot, clickable to retry
 */

type BridgeState = 'connected' | 'reconnecting' | 'disconnected';

const STATE_COLORS: Record<BridgeState, string> = {
  connected: 'rgb(34, 197, 94)',
  reconnecting: 'rgb(245, 158, 11)',
  disconnected: 'rgb(239, 68, 68)',
};

const STATE_LABELS: Record<BridgeState, string> = {
  connected: 'Connected',
  reconnecting: 'Reconnecting...',
  disconnected: 'Bridge offline',
};

const FADE_DELAY_MS = 3000;

const INDICATOR_STYLES = `
  :host {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 10000;
    pointer-events: auto;
  }

  .bridge-indicator {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 12px;
    padding: 4px 12px;
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    line-height: 1;
    white-space: nowrap;
    user-select: none;
    transition: opacity 0.3s ease, transform 0.2s ease;
    opacity: 1;
  }

  .bridge-indicator.faded {
    opacity: 0.15;
  }

  .bridge-indicator.faded:hover {
    opacity: 1;
  }

  .bridge-indicator[data-state="disconnected"] {
    cursor: pointer;
  }

  .bridge-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .bridge-indicator[data-state="reconnecting"] .bridge-dot {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`;

export class BridgeIndicator {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private currentState: BridgeState = 'disconnected';
  private fadeTimeout: ReturnType<typeof setTimeout> | null = null;
  private retryCallback: (() => void) | null = null;
  private attemptCount: number = 0;

  render(parent: HTMLElement): void {
    // Avoid double-render
    if (this.host) {
      return;
    }

    this.host = document.createElement('div');
    this.host.className = 'bridge-indicator-host';
    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = INDICATOR_STYLES;
    this.shadow.appendChild(style);

    // Build DOM
    const pill = document.createElement('div');
    pill.className = 'bridge-indicator';
    pill.setAttribute('data-state', this.currentState);

    const dot = document.createElement('div');
    dot.className = 'bridge-dot';
    dot.style.backgroundColor = STATE_COLORS[this.currentState];

    const label = document.createElement('span');
    label.className = 'bridge-label';
    label.textContent = STATE_LABELS[this.currentState];

    pill.appendChild(dot);
    pill.appendChild(label);

    // Click handler for retry in disconnected state
    pill.addEventListener('click', () => {
      if (this.currentState === 'disconnected' && this.retryCallback) {
        this.retryCallback();
      }
    });

    this.shadow.appendChild(pill);
    parent.appendChild(this.host);
  }

  updateState(state: BridgeState, attemptCount?: number): void {
    this.currentState = state;
    this.attemptCount = attemptCount ?? 0;

    // Clear any pending fade timeout
    this.clearFadeTimeout();

    if (!this.shadow) {
      return;
    }

    const pill = this.shadow.querySelector<HTMLElement>('.bridge-indicator');
    if (!pill) {
      return;
    }

    const dot = this.shadow.querySelector<HTMLElement>('.bridge-dot');
    const label = this.shadow.querySelector<HTMLElement>('.bridge-label');

    // Update state attribute
    pill.setAttribute('data-state', state);

    // Remove faded class (will re-add if connected after delay)
    pill.classList.remove('faded');

    // Update dot color
    if (dot) {
      dot.style.backgroundColor = STATE_COLORS[state];
    }

    // Update label text
    if (label) {
      if (state === 'reconnecting') {
        label.textContent = `Reconnecting... (${this.attemptCount})`;
      } else {
        label.textContent = STATE_LABELS[state];
      }
    }

    // Auto-fade when connected
    if (state === 'connected') {
      this.fadeTimeout = setTimeout(() => {
        pill.classList.add('faded');
      }, FADE_DELAY_MS);
    }
  }

  onRetry(callback: () => void): void {
    this.retryCallback = callback;
  }

  dispose(): void {
    this.clearFadeTimeout();

    if (this.host) {
      this.host.remove();
      this.host = null;
      this.shadow = null;
    }

    this.retryCallback = null;
  }

  private clearFadeTimeout(): void {
    if (this.fadeTimeout !== null) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }
  }
}

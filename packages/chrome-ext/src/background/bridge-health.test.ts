import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChromeBridgeHealth } from './bridge-health';

// ---------------------------------------------------------------------------
// Chrome API mock
// ---------------------------------------------------------------------------

function setupChromeMock(sendNativeMessage: typeof chrome.runtime.sendNativeMessage) {
  vi.stubGlobal('chrome', {
    runtime: {
      sendNativeMessage,
      lastError: null as chrome.runtime.LastError | null,
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn(),
    },
  });
}

/** Helper: create a mock that succeeds with { success: true, seq } */
function successMock() {
  return vi.fn((_app: string, message: { seq?: number }, callback: (response: unknown) => void) => {
    (chrome.runtime as { lastError: null }).lastError = null;
    callback({ success: true, seq: message.seq ?? 0 });
  }) as unknown as typeof chrome.runtime.sendNativeMessage;
}

/** Helper: create a mock that fails via lastError */
function failureMock(message = 'Host not found') {
  return vi.fn((_app: string, _message: unknown, callback: (response: unknown) => void) => {
    (chrome.runtime as { lastError: chrome.runtime.LastError | null }).lastError = { message };
    callback(undefined);
  }) as unknown as typeof chrome.runtime.sendNativeMessage;
}

describe('ChromeBridgeHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupChromeMock(successMock());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------

  it('has correct initial state', () => {
    const bh = new ChromeBridgeHealth();
    expect(bh.state).toBe('disconnected');
    expect(bh.lastHeartbeat).toBeNull();
    expect(bh.consecutiveFailures).toBe(0);
  });

  // -----------------------------------------------------------------------
  // connect()
  // -----------------------------------------------------------------------

  it('connect() transitions to connected on success', async () => {
    const bh = new ChromeBridgeHealth();
    await bh.connect();

    expect(bh.state).toBe('connected');
    expect(bh.lastHeartbeat).toBeTypeOf('number');
    expect(bh.consecutiveFailures).toBe(0);
  });

  it('connect() transitions to disconnected on failure', async () => {
    setupChromeMock(failureMock());

    const bh = new ChromeBridgeHealth();
    await bh.connect();

    expect(bh.state).toBe('disconnected');
    expect(bh.consecutiveFailures).toBe(1);
  });

  // -----------------------------------------------------------------------
  // disconnect()
  // -----------------------------------------------------------------------

  it('disconnect() clears intervals and sets state to disconnected', async () => {
    const bh = new ChromeBridgeHealth();
    await bh.connect();
    expect(bh.state).toBe('connected');

    bh.disconnect();

    expect(bh.state).toBe('disconnected');
    expect(bh.consecutiveFailures).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Heartbeat failures
  // -----------------------------------------------------------------------

  it('transitions to reconnecting after 2 consecutive heartbeat failures', async () => {
    const mock = successMock();
    setupChromeMock(mock);

    const bh = new ChromeBridgeHealth();
    await bh.connect();
    expect(bh.state).toBe('connected');

    // Switch to failure mock after connection
    const failMock = failureMock();
    setupChromeMock(failMock);

    // Advance past 2 heartbeat intervals (30s each)
    await vi.advanceTimersByTimeAsync(30_000); // first failure
    await vi.advanceTimersByTimeAsync(30_000); // second failure

    expect(bh.consecutiveFailures).toBe(2);
    expect(bh.state).toBe('reconnecting');
  });

  it('transitions to disconnected after 5 consecutive failures', async () => {
    const mock = successMock();
    setupChromeMock(mock);

    const bh = new ChromeBridgeHealth();
    await bh.connect();
    expect(bh.state).toBe('connected');

    // Switch to failure
    setupChromeMock(failureMock());

    // Advance through heartbeats: failures 1 and 2 happen at 30s intervals
    await vi.advanceTimersByTimeAsync(30_000); // failure 1
    await vi.advanceTimersByTimeAsync(30_000); // failure 2 -> reconnecting

    // Now reconnection kicks in with backoff. We need to accumulate
    // to 5 total failures (we have 2 so far from heartbeats).
    // Reconnect attempts: backoff 2s (failure 3), 4s (failure 4), 8s (failure 5) -> disconnected
    await vi.advanceTimersByTimeAsync(2_000); // reconnect attempt 3
    await vi.advanceTimersByTimeAsync(4_000); // reconnect attempt 4
    await vi.advanceTimersByTimeAsync(8_000); // reconnect attempt 5 -> disconnected

    expect(bh.consecutiveFailures).toBe(5);
    expect(bh.state).toBe('disconnected');
  });

  // -----------------------------------------------------------------------
  // onStateChange
  // -----------------------------------------------------------------------

  it('onStateChange callbacks fire on state transitions', async () => {
    const bh = new ChromeBridgeHealth();
    const states: string[] = [];
    bh.onStateChange((s) => states.push(s));

    await bh.connect();
    expect(states).toContain('connected');

    bh.disconnect();
    expect(states).toContain('disconnected');
  });

  it('callbacks do not fire when state does not change', () => {
    const bh = new ChromeBridgeHealth();
    const cb = vi.fn();
    bh.onStateChange(cb);

    // Already disconnected, disconnect again
    bh.disconnect();

    // setState guards on same-state, so no notification fires
    expect(cb).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Reconnection success
  // -----------------------------------------------------------------------

  it('reconnection succeeds and restores connected state', async () => {
    // Start with success, then fail, then succeed again
    let shouldFail = false;
    const dynamicMock = vi.fn(
      (_app: string, message: { seq?: number }, callback: (response: unknown) => void) => {
        if (shouldFail) {
          (chrome.runtime as { lastError: chrome.runtime.LastError | null }).lastError = {
            message: 'Host not found',
          };
          callback(undefined);
        } else {
          (chrome.runtime as { lastError: null }).lastError = null;
          callback({ success: true, seq: message.seq ?? 0 });
        }
      }
    ) as unknown as typeof chrome.runtime.sendNativeMessage;

    setupChromeMock(dynamicMock);

    const bh = new ChromeBridgeHealth();
    await bh.connect();
    expect(bh.state).toBe('connected');

    // Start failing
    shouldFail = true;
    await vi.advanceTimersByTimeAsync(30_000); // failure 1
    await vi.advanceTimersByTimeAsync(30_000); // failure 2 -> reconnecting
    expect(bh.state).toBe('reconnecting');

    // Recover
    shouldFail = false;
    await vi.advanceTimersByTimeAsync(2_000); // reconnect backoff -> success

    expect(bh.state).toBe('connected');
    expect(bh.consecutiveFailures).toBe(0);
  });
});

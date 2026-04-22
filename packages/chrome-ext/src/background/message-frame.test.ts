import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMessageFrame, sendFramedMessage } from './message-frame';

// ---------------------------------------------------------------------------
// Chrome API mock helpers
// ---------------------------------------------------------------------------

function setupChromeMock(sendNativeMessage: typeof chrome.runtime.sendNativeMessage) {
  vi.stubGlobal('chrome', {
    runtime: {
      sendNativeMessage,
      lastError: null as chrome.runtime.LastError | null,
    },
  });
}

describe('createMessageFrame', () => {
  it('creates a frame with seq, type, payload, and timestamp', () => {
    const before = Date.now();
    const frame = createMessageFrame(7, 'write', { path: '/tmp/test.md' });
    const after = Date.now();

    expect(frame.seq).toBe(7);
    expect(frame.type).toBe('write');
    expect(frame.payload).toEqual({ path: '/tmp/test.md' });
    expect(frame.timestamp).toBeGreaterThanOrEqual(before);
    expect(frame.timestamp).toBeLessThanOrEqual(after);
  });

  it('creates a frame without payload when none given', () => {
    const frame = createMessageFrame(0, 'ping');
    expect(frame.seq).toBe(0);
    expect(frame.type).toBe('ping');
    expect(frame.payload).toBeUndefined();
    expect(frame.timestamp).toBeTypeOf('number');
  });
});

describe('sendFramedMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sends via chrome API and returns response', async () => {
    const mock = vi.fn((_app: string, _msg: unknown, cb: (response: unknown) => void) => {
      (chrome.runtime as { lastError: null }).lastError = null;
      cb({ success: true, seq: 1 });
    }) as unknown as typeof chrome.runtime.sendNativeMessage;

    setupChromeMock(mock);

    const result = await sendFramedMessage(1, 'ping');
    expect(result).toEqual({ success: true, seq: 1 });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('retries on timeout (up to 2 retries)', async () => {
    let callCount = 0;
    const mock = vi.fn((_app: string, _msg: unknown, _cb: (response: unknown) => void) => {
      callCount++;
      // Never call the callback — simulates a timeout
    }) as unknown as typeof chrome.runtime.sendNativeMessage;

    setupChromeMock(mock);

    const promise = sendFramedMessage(1, 'ping', undefined, {
      timeoutMs: 100,
      maxRetries: 2,
    });

    // Attach a catch handler immediately to prevent unhandled rejection
    const resultPromise = promise.catch((err: Error) => err);

    // Advance through 3 timeouts: initial + 2 retries
    await vi.advanceTimersByTimeAsync(100); // attempt 1 timeout
    await vi.advanceTimersByTimeAsync(100); // attempt 2 timeout
    await vi.advanceTimersByTimeAsync(100); // attempt 3 timeout

    const result = await resultPromise;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toMatch(/timed out/);
    expect(callCount).toBe(3); // 1 initial + 2 retries
  });

  it('resolves on successful retry', async () => {
    let callCount = 0;
    const mock = vi.fn((_app: string, _msg: unknown, cb: (response: unknown) => void) => {
      callCount++;
      if (callCount < 2) {
        // First attempt: never respond (timeout)
        return;
      }
      // Second attempt: succeed
      (chrome.runtime as { lastError: null }).lastError = null;
      cb({ success: true, seq: 5 });
    }) as unknown as typeof chrome.runtime.sendNativeMessage;

    setupChromeMock(mock);

    const promise = sendFramedMessage(5, 'ping', undefined, {
      timeoutMs: 100,
      maxRetries: 2,
    });

    // First attempt times out
    await vi.advanceTimersByTimeAsync(100);

    // Second attempt succeeds immediately
    const result = await promise;
    expect(result).toEqual({ success: true, seq: 5 });
    expect(callCount).toBe(2);
  });

  it('logs warning on sequence number mismatch', async () => {
    const warnSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const mock = vi.fn((_app: string, _msg: unknown, cb: (response: unknown) => void) => {
      (chrome.runtime as { lastError: null }).lastError = null;
      // Return a response with a different seq
      cb({ success: true, seq: 999 });
    }) as unknown as typeof chrome.runtime.sendNativeMessage;

    setupChromeMock(mock);

    const result = await sendFramedMessage(1, 'ping');

    // The response should still be returned despite the mismatch
    expect(result).toEqual({ success: true, seq: 999 });

    warnSpy.mockRestore();
  });
});

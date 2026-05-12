import { describe, expect, it, vi } from 'vitest';
import { createBridgeRecovery } from '../../background/logging/bridge-recovery';

type BridgeState = 'connected' | 'reconnecting' | 'disconnected';

class FakeBridge {
  cb?: (s: BridgeState) => void;
  onStateChange(cb: (s: BridgeState) => void) {
    this.cb = cb;
  }
  fire(s: BridgeState) {
    this.cb!(s);
  }
}

class FakeTransport {
  calls = 0;
  flushFromIdb = vi.fn(() => {
    this.calls++;
    return Promise.resolve({ flushed: 0, remaining: 0 });
  });
}

describe('BridgeRecovery', () => {
  it('triggers a flush after debounce on transition to connected', () => {
    vi.useFakeTimers();
    const bridge = new FakeBridge();
    const transport = new FakeTransport();
    const r = createBridgeRecovery({ bridge, transport, debounceMs: 100 });
    r.start();
    bridge.fire('connected');
    expect(transport.calls).toBe(0);
    vi.advanceTimersByTime(100);
    expect(transport.calls).toBe(1);
    vi.useRealTimers();
  });

  it('debounces repeated connected events into one flush', () => {
    vi.useFakeTimers();
    const bridge = new FakeBridge();
    const transport = new FakeTransport();
    const r = createBridgeRecovery({ bridge, transport, debounceMs: 100 });
    r.start();
    bridge.fire('connected');
    vi.advanceTimersByTime(50);
    bridge.fire('connected');
    vi.advanceTimersByTime(50);
    expect(transport.calls).toBe(0);
    vi.advanceTimersByTime(50);
    expect(transport.calls).toBe(1);
    vi.useRealTimers();
  });

  it('cancels pending flush when bridge drops before debounce', () => {
    vi.useFakeTimers();
    const bridge = new FakeBridge();
    const transport = new FakeTransport();
    const r = createBridgeRecovery({ bridge, transport, debounceMs: 100 });
    r.start();
    bridge.fire('connected');
    vi.advanceTimersByTime(50);
    bridge.fire('disconnected');
    vi.advanceTimersByTime(100);
    expect(transport.calls).toBe(0);
    vi.useRealTimers();
  });

  it('cancels pending flush when bridge transitions to reconnecting', () => {
    vi.useFakeTimers();
    const bridge = new FakeBridge();
    const transport = new FakeTransport();
    const r = createBridgeRecovery({ bridge, transport, debounceMs: 100 });
    r.start();
    bridge.fire('connected');
    vi.advanceTimersByTime(50);
    bridge.fire('reconnecting');
    vi.advanceTimersByTime(100);
    expect(transport.calls).toBe(0);
    vi.useRealTimers();
  });

  it('stop prevents future flushes', () => {
    vi.useFakeTimers();
    const bridge = new FakeBridge();
    const transport = new FakeTransport();
    const r = createBridgeRecovery({ bridge, transport, debounceMs: 100 });
    r.start();
    r.stop();
    bridge.fire('connected');
    vi.advanceTimersByTime(100);
    expect(transport.calls).toBe(0);
    vi.useRealTimers();
  });

  it('stop cancels a pending timer', () => {
    vi.useFakeTimers();
    const bridge = new FakeBridge();
    const transport = new FakeTransport();
    const r = createBridgeRecovery({ bridge, transport, debounceMs: 100 });
    r.start();
    bridge.fire('connected');
    vi.advanceTimersByTime(50);
    r.stop();
    vi.advanceTimersByTime(100);
    expect(transport.calls).toBe(0);
    vi.useRealTimers();
  });

  it('swallows transport errors without throwing', async () => {
    vi.useFakeTimers();
    const bridge = new FakeBridge();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const transport = {
      flushFromIdb: () => Promise.reject(new Error('boom')),
    } as unknown as { flushFromIdb: () => Promise<{ flushed: number; remaining: number }> };
    const r = createBridgeRecovery({ bridge, transport, debounceMs: 10 });
    r.start();
    bridge.fire('connected');
    vi.advanceTimersByTime(10);
    await vi.runAllTimersAsync();
    // No throw; the callback caught the rejection.
    warnSpy.mockRestore();
    vi.useRealTimers();
  });

  it('uses default debounceMs of 1000 when not specified', () => {
    vi.useFakeTimers();
    const bridge = new FakeBridge();
    const transport = new FakeTransport();
    const r = createBridgeRecovery({ bridge, transport });
    r.start();
    bridge.fire('connected');
    vi.advanceTimersByTime(999);
    expect(transport.calls).toBe(0);
    vi.advanceTimersByTime(1);
    expect(transport.calls).toBe(1);
    vi.useRealTimers();
  });
});

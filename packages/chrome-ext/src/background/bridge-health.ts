/**
 * Chrome native host bridge health monitor.
 *
 * Implements the BridgeHealth interface from @mdreview/core, providing
 * heartbeat-based health monitoring with automatic reconnection for
 * the Chrome native messaging host.
 */

import type { BridgeHealth } from '@mdreview/core';
import { debug } from '../utils/debug-logger';

const NATIVE_HOST_APP = 'com.mdreview.filewriter';
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_CONSECUTIVE_FAILURES = 5;
const RECONNECT_FAILURE_THRESHOLD = 2;
const MAX_BACKOFF_MS = 30_000;

export class ChromeBridgeHealth implements BridgeHealth {
  state: 'connected' | 'reconnecting' | 'disconnected' = 'disconnected';
  lastHeartbeat: number | null = null;
  consecutiveFailures: number = 0;

  private listeners: Set<(state: BridgeHealth['state']) => void> = new Set();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private sequenceCounter: number = 0;

  async connect(): Promise<void> {
    // Clear any existing reconnect timer
    this.clearReconnectTimeout();

    try {
      await this.sendPing();
      this.lastHeartbeat = Date.now();
      this.consecutiveFailures = 0;
      this.setState('connected');
      this.startHeartbeat();
    } catch {
      this.consecutiveFailures++;
      this.setState('disconnected');
      this.startReconnection();
    }
  }

  disconnect(): void {
    this.clearHeartbeat();
    this.clearReconnectTimeout();
    this.consecutiveFailures = 0;
    this.setState('disconnected');
  }

  onStateChange(cb: (state: BridgeHealth['state']) => void): void {
    this.listeners.add(cb);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private nextSeq(): number {
    return this.sequenceCounter++;
  }

  private setState(newState: BridgeHealth['state']): void {
    if (this.state === newState) return;
    this.state = newState;
    for (const cb of this.listeners) {
      try {
        cb(newState);
      } catch (err) {
        debug.error('BridgeHealth', 'Listener threw:', err);
      }
    }
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      void this.heartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private async heartbeat(): Promise<void> {
    try {
      await this.sendPing();
      this.lastHeartbeat = Date.now();
      this.consecutiveFailures = 0;
    } catch {
      this.consecutiveFailures++;
      debug.warn('BridgeHealth', `Heartbeat failed (${this.consecutiveFailures} consecutive)`);

      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.clearHeartbeat();
        this.setState('disconnected');
      } else if (this.consecutiveFailures >= RECONNECT_FAILURE_THRESHOLD) {
        this.clearHeartbeat();
        this.setState('reconnecting');
        this.startReconnection();
      }
    }
  }

  private startReconnection(): void {
    this.clearReconnectTimeout();

    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this.setState('disconnected');
      return;
    }

    const backoffMs = Math.min(1000 * Math.pow(2, this.consecutiveFailures - 1), MAX_BACKOFF_MS);

    debug.log('BridgeHealth', `Reconnecting in ${backoffMs}ms`);

    this.reconnectTimeout = setTimeout(() => {
      void this.attemptReconnect();
    }, backoffMs);
  }

  private async attemptReconnect(): Promise<void> {
    try {
      await this.sendPing();
      this.lastHeartbeat = Date.now();
      this.consecutiveFailures = 0;
      this.setState('connected');
      this.startHeartbeat();
    } catch {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.setState('disconnected');
      } else {
        this.startReconnection();
      }
    }
  }

  private sendPing(): Promise<unknown> {
    const seq = this.nextSeq();
    return new Promise((resolve, reject) => {
      chrome.runtime.sendNativeMessage(
        NATIVE_HOST_APP,
        { action: 'ping', seq },
        (response: unknown) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message ?? 'Unknown native messaging error'));
          } else {
            resolve(response);
          }
        }
      );
    });
  }
}

/**
 * Message framing utilities for reliable native host messaging.
 *
 * Wraps outgoing messages with sequence numbers and timestamps,
 * and adds timeout + retry logic for resilience.
 */

import { debug } from '../utils/debug-logger';

const NATIVE_HOST_APP = 'com.mdreview.filewriter';
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_RETRIES = 2;

export interface FramedMessage {
  seq: number;
  type: string;
  payload?: unknown;
  timestamp: number;
}

export interface FramedResponse {
  seq: number;
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface SendOptions {
  /** Timeout per attempt in milliseconds (default 5000) */
  timeoutMs?: number;
  /** Maximum number of retries after timeout (default 2) */
  maxRetries?: number;
}

/**
 * Create a framed message envelope.
 */
export function createMessageFrame(seq: number, action: string, payload?: unknown): FramedMessage {
  return {
    seq,
    type: action,
    payload,
    timestamp: Date.now(),
  };
}

/**
 * Send a framed message to the native host with timeout and retry.
 *
 * The outgoing payload is wrapped with `action`, `seq`, and `timestamp`.
 * On timeout the request is retried up to `maxRetries` times.
 * A sequence-number mismatch in the response triggers a warning but
 * still returns the response.
 */
export async function sendFramedMessage(
  seq: number,
  action: string,
  payload?: unknown,
  options?: SendOptions
): Promise<FramedResponse> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const frame = createMessageFrame(seq, action, payload);

  // Build the native-messaging payload.  The host expects `action` at the
  // top level, so we spread the payload and add framing fields.
  const nativePayload = {
    action,
    seq,
    timestamp: frame.timestamp,
    ...(payload != null && typeof payload === 'object' ? payload : {}),
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await sendWithTimeout(nativePayload, timeoutMs);

      // Warn on sequence mismatch but still return the response
      if (response && typeof response === 'object' && 'seq' in response) {
        if ((response as FramedResponse).seq !== seq) {
          debug.warn(
            'MessageFrame',
            `Sequence mismatch: expected ${seq}, got ${(response as FramedResponse).seq}`
          );
        }
      }

      return response as FramedResponse;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        debug.warn(
          'MessageFrame',
          `Attempt ${attempt + 1} failed, retrying (${maxRetries - attempt} left)`
        );
      }
    }
  }

  throw lastError;
}

/**
 * Send a native message with a timeout guard.
 */
function sendWithTimeout(payload: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Native message timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    chrome.runtime.sendNativeMessage(NATIVE_HOST_APP, payload, (response: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message ?? 'Unknown native messaging error'));
      } else {
        resolve(response);
      }
    });
  });
}

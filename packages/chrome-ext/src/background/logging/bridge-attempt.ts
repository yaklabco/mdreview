import {
  ATTR_MDVIEW_BRIDGE_ATTEMPT,
  ATTR_MDVIEW_BRIDGE_OUTCOME,
  ATTR_MDVIEW_IPC_CHANNEL,
  getLogger,
  type Logger,
} from '@mdreview/core/logging';

const ATTR_DURATION_MS = 'duration_ms';

/**
 * Module-scoped bridge logger. Hoisted so every native-host attempt reuses
 * the same Logger instance instead of recreating one per case.
 */
const bridgeLogger: Logger = getLogger('bridge');

/**
 * Record a single native-host bridge attempt as a structured log record.
 *
 * Successful attempts are emitted at INFO with body `bridge.attempt.ok`.
 * Failed attempts are emitted at ERROR with body `bridge.attempt.failed`
 * and lift `exception.*` attributes from the provided error.
 *
 * Exported so unit tests can drive it directly without standing up the
 * full `chrome.runtime.onMessage` harness.
 */
export function recordBridgeAttempt(
  channel: string,
  attempt: number,
  outcome: 'ok' | 'error',
  durationMs: number,
  err?: unknown
): void {
  const attrs = {
    [ATTR_MDVIEW_IPC_CHANNEL]: channel,
    [ATTR_MDVIEW_BRIDGE_ATTEMPT]: attempt,
    [ATTR_MDVIEW_BRIDGE_OUTCOME]: outcome,
    [ATTR_DURATION_MS]: durationMs,
  };

  if (outcome === 'ok') {
    bridgeLogger.info('bridge.attempt.ok', attrs);
    return;
  }

  const lifted =
    err instanceof Error ? err : new Error(err === undefined ? 'unknown' : String(err));
  bridgeLogger.error('bridge.attempt.failed', attrs, lifted);
}

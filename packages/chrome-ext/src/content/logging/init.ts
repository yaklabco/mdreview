import { initLogging, type ResourceAttrs } from '@mdreview/core/logging';
import { RemoteTransport } from './remote-transport';

export type ChromeContextNamespace = 'chrome-content' | 'chrome-ext';

/**
 * Initialise the logger for a non-SW Chrome context (content script or popup).
 * Builds a `RemoteTransport` that forwards every batch to the service worker
 * as a `LOG_BATCH` message; the SW owns the native-host + IndexedDB plumbing.
 */
export function initRemoteLogging(namespace: ChromeContextNamespace, version: string): void {
  const transport = new RemoteTransport();
  const resource: ResourceAttrs = {
    'service.name': 'mdview',
    'service.version': version,
    'service.namespace': namespace,
    'deployment.environment': 'prod',
    'host.os': 'unknown',
  };
  initLogging({ transport, resource });
}

import type { ResourceAttrs } from '@mdreview/core/logging';
import { FileTransport } from './file-transport';

export interface RuntimeContext {
  version: string;
  platform: string;
  isPackaged: boolean;
}

/**
 * Build the resource attributes that identify the Electron main process to the
 * logging pipeline. Kept here so the renderer can mirror the shape via the
 * preload getRuntimeInfo bridge.
 */
export function buildMainResource(ctx: RuntimeContext): ResourceAttrs {
  return {
    'service.name': 'mdview',
    'service.version': ctx.version,
    'service.namespace': 'electron-main',
    'deployment.environment': ctx.isPackaged ? 'prod' : 'dev',
    'host.os': ctx.platform,
  };
}

export interface BuildLoggingResult {
  transport: FileTransport;
  resource: ResourceAttrs;
}

/**
 * Construct the main-process FileTransport and its matching resource. The same
 * transport instance is shared with the IPC LOG_BATCH handler so renderer
 * records land in the same JSONL file.
 */
export function buildLogging(ctx: RuntimeContext): BuildLoggingResult {
  const transport = new FileTransport({ source: 'electron' });
  const resource = buildMainResource(ctx);
  return { transport, resource };
}

import type { Attributes, LogRecord, ResourceAttrs } from './log-record';
import { createLogger, type Logger } from './logger';
import { BatchLogRecordProcessor, createProcessor } from './processor';
import { RingBuffer } from './ring-buffer';
import type { LogTransport } from './transport';

export interface InitLoggingOpts {
  transport: LogTransport;
  resource: ResourceAttrs;
  maxBatch?: number;
  flushIntervalMs?: number;
  ringMaxBytes?: number;
}

// Placeholder resource used by loggers obtained before initLogging runs.
// Pre-init records keep this placeholder permanently; we do not retroactively
// rewrite history because the boot-time uncertainty is meaningful signal.
const PLACEHOLDER_RESOURCE: ResourceAttrs = {
  'service.name': 'mdview',
  'service.version': '0.0.0',
  'service.namespace': 'electron-main',
  'deployment.environment': 'dev',
  'host.os': 'unknown',
};

const PRE_INIT_BUFFER_MAX_BYTES = 1_048_576;

type State =
  | { kind: 'pending'; buffer: RingBuffer<LogRecord> }
  | { kind: 'ready'; processor: BatchLogRecordProcessor; resource: ResourceAttrs };

function freshPendingState(): State {
  return {
    kind: 'pending',
    buffer: new RingBuffer<LogRecord>({
      maxBytes: PRE_INIT_BUFFER_MAX_BYTES,
      sizeOf: (r) => JSON.stringify(r).length,
    }),
  };
}

let state: State = freshPendingState();
const loggerCache = new Map<string, Logger>();

// routedEmit is the shared sink for every cached logger. It reads the current
// state at call time, rewrites `record.resource` to the live resource when the
// processor is ready, and otherwise buffers into the pre-init RingBuffer with
// the placeholder resource intact. This is what gives logger identity stability
// across initLogging: the closure captured in createLogger keeps pointing at
// the same function, but the routing target changes.
function routedEmit(record: LogRecord): void {
  if (state.kind === 'pending') {
    state.buffer.push(record);
    return;
  }
  // Post-init: stamp the live resource on the record so loggers obtained
  // before init still emit records with the real resource for any post-init
  // calls. Pre-init records replayed during initLogging keep their placeholder.
  const stamped: LogRecord = { ...record, resource: state.resource };
  state.processor.emit(stamped);
}

export function initLogging(opts: InitLoggingOpts): void {
  if (state.kind === 'ready') {
    // Re-init without shutdown: best-effort replacement.
    // eslint-disable-next-line no-console
    console.warn('initLogging called twice without shutdownLogging in between');
  }
  const processor = createProcessor({
    transport: opts.transport,
    maxBatch: opts.maxBatch,
    flushIntervalMs: opts.flushIntervalMs,
    ringMaxBytes: opts.ringMaxBytes,
  });

  const previous = state;
  state = { kind: 'ready', processor, resource: opts.resource };

  if (previous.kind === 'pending') {
    const drained = previous.buffer.drain();
    // Replay records keep their original placeholder resource by design.
    // We emit one at a time; with small maxBatch values the processor's
    // in-flight flush can deflect subsequent flushes, so we schedule a
    // follow-up flush on the next microtask to drain anything left in
    // pending once the initial export settles.
    for (const r of drained) processor.emit(r);
    if (drained.length > 0) {
      queueMicrotask(() => {
        void processor.flush();
      });
    }
  }
}

export async function shutdownLogging(): Promise<void> {
  if (state.kind === 'ready') {
    const processor = state.processor;
    state = freshPendingState();
    loggerCache.clear();
    await processor.shutdown();
    return;
  }
  // Pending: just reset.
  state = freshPendingState();
  loggerCache.clear();
}

export function getLogger(name: string, attrs?: Attributes): Logger {
  const cached = loggerCache.get(name);
  if (cached) return cached;
  // Resource passed here is the placeholder; routedEmit rewrites it to the
  // live resource after initLogging. Pre-init buffered records keep the
  // placeholder, by design.
  const logger = createLogger({
    emit: routedEmit,
    resource: PLACEHOLDER_RESOURCE,
    namespace: name,
    baseAttrs: attrs,
  });
  loggerCache.set(name, logger);
  return logger;
}

// Re-exports
export type { LogRecord, Attributes, LogLevel, ResourceAttrs } from './log-record';
export type { Logger, Span } from './logger';
export type { LogTransport, TransportResult } from './transport';
export { NoopTransport } from './transport';
export * from './semconv';
export {
  currentFileName,
  dateStem,
  nextSizeSuffix,
  planPrune,
  planRotation,
} from './file-rotation';
export type { DirEntry, LogSource, RotationAction, RotationOpts } from './file-rotation';

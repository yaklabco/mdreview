import type { Attributes, LogRecord, LogLevel, ResourceAttrs, SeverityText } from './log-record';
import { severityNumberFor, severityTextFor } from './log-record';
import {
  ATTR_CODE_NAMESPACE,
  ATTR_DURATION_NS,
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
  ATTR_EXCEPTION_TYPE,
} from './semconv';

export interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  addEvent(name: string, attrs?: Attributes): void;
}

export interface Logger {
  trace(msg: string, attrs?: Attributes): void;
  debug(msg: string, attrs?: Attributes): void;
  info(msg: string, attrs?: Attributes): void;
  warn(msg: string, attrs?: Attributes): void;
  error(msg: string, attrs?: Attributes, err?: Error): void;
  fatal(msg: string, attrs?: Attributes, err?: Error): void;
  child(name: string, attrs?: Attributes): Logger;
  withSpan<T>(name: string, fn: (span: Span) => T, attrs?: Attributes): T;
}

export interface EmitFn {
  (record: LogRecord): void;
}

export interface CreateLoggerOpts {
  emit: EmitFn;
  resource: ResourceAttrs;
  namespace?: string;
  baseAttrs?: Attributes;
  now?: () => number;
  randomBytes?: (n: number) => Uint8Array;
}

const ATTR_SPAN_NAME = 'mdview.span.name';
const ATTR_SPAN_STATUS = 'mdview.span.status';
const ATTR_SPAN_EVENT = 'mdview.span.event';

type MutableAttrs = Record<string, string | number | boolean | undefined>;

interface NodeCryptoLike {
  randomBytes(n: number): Uint8Array;
}

function resolveDefaultRandomBytes(): (n: number) => Uint8Array {
  // Try Node first, then Web Crypto.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const req = (globalThis as { require?: (m: string) => unknown }).require;
    if (typeof req === 'function') {
      const mod = req('crypto') as NodeCryptoLike | undefined;
      if (mod && typeof mod.randomBytes === 'function') {
        return (n: number) => new Uint8Array(mod.randomBytes(n));
      }
    }
  } catch {
    // fall through to web crypto
  }
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    return (n: number) => {
      const out = new Uint8Array(n);
      webCrypto.getRandomValues(out);
      return out;
    };
  }
  // Last-resort, non-crypto fallback. Should never be reached in supported envs.
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
    return out;
  };
}

const defaultRandomBytes = resolveDefaultRandomBytes();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function isThenable(v: unknown): v is PromiseLike<unknown> {
  return v != null && typeof (v as { then?: unknown }).then === 'function';
}

function liftException(err: unknown): MutableAttrs {
  if (err instanceof Error) {
    return {
      [ATTR_EXCEPTION_TYPE]: err.name,
      [ATTR_EXCEPTION_MESSAGE]: err.message,
      [ATTR_EXCEPTION_STACKTRACE]: err.stack ?? '',
    };
  }
  // Try to lift Error-shaped values.
  if (err && typeof err === 'object') {
    const e = err as { name?: unknown; message?: unknown; stack?: unknown };
    return {
      [ATTR_EXCEPTION_TYPE]: typeof e.name === 'string' ? e.name : 'Error',
      [ATTR_EXCEPTION_MESSAGE]: typeof e.message === 'string' ? e.message : String(err),
      [ATTR_EXCEPTION_STACKTRACE]: typeof e.stack === 'string' ? e.stack : '',
    };
  }
  return {
    [ATTR_EXCEPTION_TYPE]: 'Error',
    [ATTR_EXCEPTION_MESSAGE]: String(err),
    [ATTR_EXCEPTION_STACKTRACE]: '',
  };
}

function mergeAttrs(...parts: (Attributes | MutableAttrs | undefined)[]): Attributes {
  const out: MutableAttrs = {};
  for (const p of parts) {
    if (!p) continue;
    for (const k of Object.keys(p)) {
      const v = (p as MutableAttrs)[k];
      if (v !== undefined) out[k] = v;
    }
  }
  return out as Attributes;
}

interface InternalLoggerState {
  emit: EmitFn;
  resource: ResourceAttrs;
  namespace: string | undefined;
  baseAttrs: Attributes;
  now: () => number;
  randomBytes: (n: number) => Uint8Array;
}

function buildRecord(
  state: InternalLoggerState,
  level: LogLevel,
  body: string,
  callAttrs: Attributes | undefined,
  extra: MutableAttrs | undefined,
  ids: { traceId?: string; spanId?: string } | undefined
): LogRecord {
  const ns: MutableAttrs | undefined = state.namespace
    ? { [ATTR_CODE_NAMESPACE]: state.namespace }
    : undefined;
  // Priority (lowest -> highest): namespace, baseAttrs, extra (lifted), callAttrs.
  const attributes = mergeAttrs(ns, state.baseAttrs, extra, callAttrs);
  const ms = state.now();
  const ts = ms * 1_000_000;
  const severityNumber = severityNumberFor(level);
  const severityText: SeverityText = severityTextFor(severityNumber);
  const record: LogRecord = {
    timestamp: ts,
    observedTimestamp: ts,
    severityNumber,
    severityText,
    body,
    attributes,
    resource: state.resource,
  };
  if (ids?.traceId) record.traceId = ids.traceId;
  if (ids?.spanId) record.spanId = ids.spanId;
  return record;
}

function makeLogger(state: InternalLoggerState): Logger {
  const emitLevel = (level: LogLevel, body: string, attrs?: Attributes, err?: Error): void => {
    const extra = err ? liftException(err) : undefined;
    state.emit(buildRecord(state, level, body, attrs, extra, undefined));
  };

  const child = (name: string, attrs?: Attributes): Logger => {
    const childNs = state.namespace ? `${state.namespace}.${name}` : name;
    const merged = mergeAttrs(state.baseAttrs, attrs);
    return makeLogger({
      emit: state.emit,
      resource: state.resource,
      namespace: childNs,
      baseAttrs: merged,
      now: state.now,
      randomBytes: state.randomBytes,
    });
  };

  function withSpan<T>(name: string, fn: (span: Span) => T, attrs?: Attributes): T {
    const traceId = bytesToHex(state.randomBytes(16));
    const spanId = bytesToHex(state.randomBytes(8));
    const ids = { traceId, spanId };
    const spanAttrs: MutableAttrs = { [ATTR_SPAN_NAME]: name };

    const span: Span = {
      setAttribute(key: string, value: string | number | boolean) {
        spanAttrs[key] = value;
      },
      addEvent(eventName: string, eventAttrs?: Attributes) {
        const merged: MutableAttrs = { ...spanAttrs, [ATTR_SPAN_EVENT]: eventName };
        if (eventAttrs) {
          for (const k of Object.keys(eventAttrs)) {
            const v = eventAttrs[k];
            if (v !== undefined) merged[k] = v;
          }
        }
        state.emit(buildRecord(state, 'info', eventName, merged as Attributes, undefined, ids));
      },
    };

    const start = state.now();
    state.emit(
      buildRecord(state, 'info', `${name}.start`, mergeAttrs(spanAttrs, attrs), undefined, ids)
    );

    const emitException = (err: unknown): void => {
      const lifted = liftException(err);
      const exAttrs = mergeAttrs(spanAttrs, lifted);
      state.emit(buildRecord(state, 'error', 'exception', exAttrs, undefined, ids));
    };

    const emitEnd = (status: 'ok' | 'error'): void => {
      const end = state.now();
      const duration = (end - start) * 1_000_000;
      const endAttrs: MutableAttrs = {
        ...spanAttrs,
        [ATTR_SPAN_STATUS]: status,
        [ATTR_DURATION_NS]: duration,
      };
      state.emit(buildRecord(state, 'info', `${name}.end`, endAttrs as Attributes, undefined, ids));
    };

    let result: T;
    try {
      result = fn(span);
    } catch (err) {
      emitException(err);
      emitEnd('error');
      throw err;
    }

    if (isThenable(result)) {
      const p = (result as unknown as Promise<unknown>).then(
        (value) => {
          emitEnd('ok');
          return value;
        },
        (err) => {
          emitException(err);
          emitEnd('error');
          throw err;
        }
      );
      return p as unknown as T;
    }

    emitEnd('ok');
    return result;
  }

  return {
    trace(msg, attrs) {
      emitLevel('trace', msg, attrs);
    },
    debug(msg, attrs) {
      emitLevel('debug', msg, attrs);
    },
    info(msg, attrs) {
      emitLevel('info', msg, attrs);
    },
    warn(msg, attrs) {
      emitLevel('warn', msg, attrs);
    },
    error(msg, attrs, err) {
      emitLevel('error', msg, attrs, err);
    },
    fatal(msg, attrs, err) {
      emitLevel('fatal', msg, attrs, err);
    },
    child,
    withSpan,
  };
}

export function createLogger(opts: CreateLoggerOpts): Logger {
  const state: InternalLoggerState = {
    emit: opts.emit,
    resource: opts.resource,
    namespace: opts.namespace,
    baseAttrs: opts.baseAttrs ?? {},
    now: opts.now ?? Date.now,
    randomBytes: opts.randomBytes ?? defaultRandomBytes,
  };
  return makeLogger(state);
}

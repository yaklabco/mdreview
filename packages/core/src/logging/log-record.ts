export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type SeverityText = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export type Attributes = Readonly<Record<string, string | number | boolean | undefined>>;

export interface ResourceAttrs {
  'service.name': 'mdview';
  'service.version': string;
  'service.namespace':
    | 'chrome-ext'
    | 'chrome-content'
    | 'chrome-sw'
    | 'electron-main'
    | 'electron-renderer'
    | 'native-host';
  'deployment.environment': 'dev' | 'prod';
  'host.os': string;
}

export interface LogRecord {
  timestamp: number;
  observedTimestamp: number;
  severityNumber: number;
  severityText: SeverityText;
  body: string;
  attributes: Attributes;
  resource: ResourceAttrs;
  traceId?: string;
  spanId?: string;
}

const NUM_BY_LEVEL: Record<LogLevel, number> = {
  trace: 1,
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
  fatal: 21,
};

const TEXT_BY_NUM: Record<number, SeverityText> = {
  1: 'TRACE',
  5: 'DEBUG',
  9: 'INFO',
  13: 'WARN',
  17: 'ERROR',
  21: 'FATAL',
};

export const severityNumberFor = (lvl: LogLevel): number => NUM_BY_LEVEL[lvl];
export const severityTextFor = (n: number): SeverityText => TEXT_BY_NUM[n] ?? 'INFO';

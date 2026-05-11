import type { LogRecord } from './log-record';

export interface TransportResult {
  ok: boolean;
  reason?: string;
}

export interface LogTransport {
  export(records: readonly LogRecord[]): Promise<TransportResult>;
  shutdown?(): Promise<void>;
}

export const NoopTransport: LogTransport = {
  export() {
    return Promise.resolve({ ok: true });
  },
};

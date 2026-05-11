import { describe, expect, it } from 'vitest';
import { severityNumberFor, severityTextFor } from '../../logging/log-record';

describe('severity mapping', () => {
  it('maps each level to its OTEL number', () => {
    expect(severityNumberFor('trace')).toBe(1);
    expect(severityNumberFor('debug')).toBe(5);
    expect(severityNumberFor('info')).toBe(9);
    expect(severityNumberFor('warn')).toBe(13);
    expect(severityNumberFor('error')).toBe(17);
    expect(severityNumberFor('fatal')).toBe(21);
  });
  it('maps numbers back to text', () => {
    expect(severityTextFor(9)).toBe('INFO');
    expect(severityTextFor(17)).toBe('ERROR');
  });
});

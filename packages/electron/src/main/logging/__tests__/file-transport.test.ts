import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { LogRecord } from '@mdreview/core/logging';
import { FileTransport } from '../file-transport';

function makeRecord(i: number, bodyChars = 10): LogRecord {
  return {
    timestamp: i,
    observedTimestamp: i,
    severityNumber: 9,
    severityText: 'INFO',
    body: 'm'.repeat(bodyChars),
    attributes: {},
    resource: {
      'service.name': 'mdview',
      'service.version': '0.0.0-test',
      'service.namespace': 'electron-main',
      'deployment.environment': 'dev',
      'host.os': 'test',
    },
  };
}

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdview-log-test-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('FileTransport', () => {
  it('writes one JSONL line per record to a dated file', async () => {
    const t = new FileTransport({
      dir,
      source: 'electron',
      now: () => new Date('2026-05-11T12:00:00Z'),
    });
    const result = await t.export([makeRecord(1), makeRecord(2)]);
    expect(result.ok).toBe(true);
    const file = path.join(dir, 'mdview-electron-2026-05-11.jsonl');
    const text = await fs.readFile(file, 'utf8');
    const lines = text.trim().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]) as { body: string };
    expect(first.body).toBe('m'.repeat(10));
    await t.shutdown();
  });

  it('rotates by date at next export after the clock advances', async () => {
    let now = new Date('2026-05-11T23:59:50Z');
    const t = new FileTransport({ dir, source: 'electron', now: () => now });
    await t.export([makeRecord(1)]);
    now = new Date('2026-05-12T00:00:10Z');
    await t.export([makeRecord(2)]);
    const a = path.join(dir, 'mdview-electron-2026-05-11.jsonl');
    const b = path.join(dir, 'mdview-electron-2026-05-12.jsonl');
    expect((await fs.readFile(a, 'utf8')).trim().split('\n')).toHaveLength(1);
    expect((await fs.readFile(b, 'utf8')).trim().split('\n')).toHaveLength(1);
    await t.shutdown();
  });

  it('rolls over by size when the projected file exceeds maxBytes', async () => {
    const t = new FileTransport({
      dir,
      source: 'electron',
      maxBytes: 600,
      now: () => new Date('2026-05-11T12:00:00Z'),
    });
    await t.export([makeRecord(1)]);
    await t.export([makeRecord(2)]);
    await t.export([makeRecord(3)]);
    const names = (await fs.readdir(dir)).sort();
    expect(names.some((n) => /^mdview-electron-2026-05-11\.jsonl\.\d+$/.test(n))).toBe(true);
    expect(names).toContain('mdview-electron-2026-05-11.jsonl');
    await t.shutdown();
  });

  it('prunes files older than retentionDays based on filename stem', async () => {
    await fs.writeFile(path.join(dir, 'mdview-electron-2026-04-20.jsonl'), 'x\n');
    await fs.writeFile(path.join(dir, 'mdview-electron-2026-04-25.jsonl'), 'x\n');
    await fs.writeFile(path.join(dir, 'mdview-electron-2026-05-11.jsonl'), 'x\n');
    const t = new FileTransport({
      dir,
      source: 'electron',
      retentionDays: 14,
      now: () => new Date('2026-05-11T12:00:00Z'),
    });
    await t.export([makeRecord(1)]);
    const names = (await fs.readdir(dir)).sort();
    expect(names).toContain('mdview-electron-2026-05-11.jsonl');
    expect(names).not.toContain('mdview-electron-2026-04-20.jsonl');
    expect(names).not.toContain('mdview-electron-2026-04-25.jsonl');
    await t.shutdown();
  });

  it('returns ok:false on write failure without throwing', async () => {
    const t = new FileTransport({
      dir: '/nonexistent-readonly-mdview-test/no',
      source: 'electron',
      now: () => new Date('2026-05-11T12:00:00Z'),
    });
    const result = await t.export([makeRecord(1)]);
    expect(result.ok).toBe(false);
    expect(typeof result.reason).toBe('string');
  });
});
